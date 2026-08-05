// Module 3 — nightly job-discovery orchestration core.
//
// Every selection query in here is DB-state-driven ("does a row already
// exist for this?"), never scoped to "what did this particular run just
// fetch." That's what makes a crash mid-run safe to resume from: the next
// invocation re-derives exactly what's left to do from the database itself,
// not from anything held only in this process's memory. See the sub-chunk 4
// plan for the four idempotency scenarios this was designed against.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiClient, EngineerContext, JobListing } from "@/lib/ai/client";
import { getJobSourceAdapters } from "@/lib/job-sources/registry";
import type { Database } from "@/lib/supabase/database.types";

type DiscoveryError = {
  stage: "fetch" | "ingest" | "enrich" | "score";
  sourceSlug?: string;
  jobId?: string;
  engineerId?: string;
  error: string;
};

export type DiscoverySummary = {
  sourcesProcessed: number;
  jobsUpserted: number;
  jobsEnriched: number;
  matchesWritten: number;
  errors: DiscoveryError[];
  enrichmentCapped: boolean;
  enrichmentAttempted: number;
  enrichmentPendingTotal: number;
  scoringCapped: boolean;
  scoringAttempted: number;
  scoringPendingTotal: number;
};

// Per-invocation caps keeping a single run's wall-clock time well under
// Vercel Hobby's 300s ceiling (confirmed hard default+max under Fluid
// Compute) — at the ~2s/call pacing in groq-client.ts, 60 scoring pairs
// + 30 enrichment jobs ≈ 120s + 60s of call time, leaving ~120s of real
// margin for JSearch fetching, DB writes, and safety buffer. Hitting a
// cap is a clean, deliberate stop, not a failure — the existing
// DB-state-driven queries below (is_globally_open IS NULL, matchedPairs)
// are what make next invocation resume exactly where this one stopped,
// with no new resumption logic.
const MAX_ENRICHMENT_JOBS_PER_RUN = 30;
const MAX_SCORING_PAIRS_PER_RUN = 60;

const CRON_LOCK_ID = "discover-jobs";
const STALE_LOCK_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const COOLDOWN_MS = 15 * 60 * 1000;

export type AcquireLockResult =
  | { acquired: true }
  | { acquired: false; reason: "already_running" }
  | { acquired: false; reason: "cooldown"; nextRunAvailableAt: string };

// A single atomic conditional UPDATE, not a session-scoped Postgres
// advisory lock — this project's Supabase client talks over PostgREST/HTTP
// through the pooler, not a persistent raw connection, so there's no
// stable "session" for pg_try_advisory_lock to attach to. This pattern
// needs no such session: Postgres's own row lock during the UPDATE
// statement is what makes two concurrent callers resolve deterministically
// (one's WHERE clause matches and wins; the other's no longer matches once
// it re-evaluates against the just-committed row). That guarantee is
// unchanged below — the SELECT added for cooldown/already-running
// classification is only ever used to produce the right human-facing
// message; it is not what enforces exclusivity.
export async function acquireDiscoveryLock(supabase: SupabaseClient<Database>): Promise<AcquireLockResult> {
  const now = Date.now();
  const staleCutoff = new Date(now - STALE_LOCK_THRESHOLD_MS).toISOString();

  const { data: lockRow } = await supabase
    .from("cron_run_locks")
    .select("is_running, started_at, last_completed_at")
    .eq("id", CRON_LOCK_ID)
    .single();

  if (lockRow?.is_running && lockRow.started_at && lockRow.started_at >= staleCutoff) {
    return { acquired: false, reason: "already_running" };
  }

  if (lockRow?.last_completed_at) {
    const nextRunAvailableAt = new Date(new Date(lockRow.last_completed_at).getTime() + COOLDOWN_MS);
    if (nextRunAvailableAt.getTime() > now) {
      return { acquired: false, reason: "cooldown", nextRunAvailableAt: nextRunAvailableAt.toISOString() };
    }
  }

  const { data, error } = await supabase
    .from("cron_run_locks")
    .update({ is_running: true, started_at: new Date().toISOString() })
    .eq("id", CRON_LOCK_ID)
    .or(`is_running.eq.false,started_at.lt.${staleCutoff}`)
    .select("id");
  if (error) throw error;

  if ((data?.length ?? 0) === 0) {
    // Lost a race against a concurrent acquisition between the SELECT
    // above and this UPDATE — the same rare, harmless edge case noted
    // above; classify it as already_running since that's what actually
    // happened by the time this statement ran.
    return { acquired: false, reason: "already_running" };
  }

  return { acquired: true };
}

export async function releaseDiscoveryLock(
  supabase: SupabaseClient<Database>,
  options: { completed: boolean },
): Promise<void> {
  const update: { is_running: boolean; last_completed_at?: string } = { is_running: false };
  if (options.completed) {
    update.last_completed_at = new Date().toISOString();
  }
  await supabase.from("cron_run_locks").update(update).eq("id", CRON_LOCK_ID);
}

function computeDedupHash(job: { title: string; company_name: string; location: string | null }): string {
  const normalized = [job.title, job.company_name, job.location ?? ""]
    .map((part) => part.trim().toLowerCase())
    .join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

export async function runJobDiscovery(
  supabase: SupabaseClient<Database>,
  aiClient: AiClient,
): Promise<DiscoverySummary> {
  const summary: DiscoverySummary = {
    sourcesProcessed: 0,
    jobsUpserted: 0,
    jobsEnriched: 0,
    matchesWritten: 0,
    errors: [],
    enrichmentCapped: false,
    enrichmentAttempted: 0,
    enrichmentPendingTotal: 0,
    scoringCapped: false,
    scoringAttempted: 0,
    scoringPendingTotal: 0,
  };

  // --- Step 1: ingest listings from every active source -------------------
  const adapters = await getJobSourceAdapters(supabase);

  const { data: sourceRows } = await supabase.from("job_sources").select("id, slug").eq("is_active", true);
  const sourceIdBySlug = new Map((sourceRows ?? []).map((row) => [row.slug, row.id]));

  for (const adapter of adapters) {
    const sourceId = sourceIdBySlug.get(adapter.sourceSlug);
    if (!sourceId) {
      const message = "No matching active job_sources row found for this adapter's slug.";
      console.error(`discover-jobs: fetch failed for ${adapter.sourceSlug}`, message);
      summary.errors.push({ stage: "fetch", sourceSlug: adapter.sourceSlug, error: message });
      continue;
    }

    let listings;
    try {
      listings = await adapter.fetchListings({});
    } catch (error) {
      console.error(`discover-jobs: fetch failed for ${adapter.sourceSlug}`, error);
      summary.errors.push({ stage: "fetch", sourceSlug: adapter.sourceSlug, error: String(error) });
      continue;
    }

    for (const listing of listings) {
      try {
        const { error } = await supabase
          .from("jobs")
          .upsert(
            {
              job_source_id: sourceId,
              external_job_id: listing.externalId,
              title: listing.title,
              company_name: listing.companyName,
              location: listing.location ?? null,
              description: listing.description ?? null,
              apply_url: listing.applyUrl,
              is_remote: listing.isRemote ?? null,
              posted_at: listing.postedAt?.toISOString() ?? null,
            },
            { onConflict: "job_source_id,external_job_id" },
          );
        if (error) throw error;
        summary.jobsUpserted++;
      } catch (error) {
        console.error(`discover-jobs: ingest failed for ${adapter.sourceSlug}/${listing.externalId}`, error);
        summary.errors.push({
          stage: "ingest",
          sourceSlug: adapter.sourceSlug,
          error: String(error),
        });
      }
    }

    summary.sourcesProcessed++;
  }

  // --- Step 2: enrich jobs missing eligibility fields ---------------------
  // DB-state-driven ("is_globally_open IS NULL"), not run-scoped — a job
  // enriched by a previous, crashed run is never re-enriched, and one that
  // survived ingestion but never got enriched (the crash-mid-way case) is
  // always picked back up here regardless of which run inserted it. Gating
  // on is_globally_open (not dedup_hash) is deliberate: it's the field the
  // combined extraction call was added for, so switching the gate to it is
  // what makes rows already enriched under the old one-field shape get
  // automatically re-enriched here — no separate backfill migration needed.
  const { data: unenrichedJobs } = await supabase
    .from("jobs")
    .select("id, title, company_name, location, description")
    .is("is_globally_open", null);

  summary.enrichmentPendingTotal = unenrichedJobs?.length ?? 0;
  const enrichmentBatch = (unenrichedJobs ?? []).slice(0, MAX_ENRICHMENT_JOBS_PER_RUN);
  summary.enrichmentCapped = summary.enrichmentPendingTotal > enrichmentBatch.length;

  for (const job of enrichmentBatch) {
    summary.enrichmentAttempted++;
    try {
      const dedupHash = computeDedupHash(job);
      const { region, isGloballyOpen, possiblyClosed, possiblyClosedReason } = await aiClient.extractRemoteRegion({
        title: job.title,
        companyName: job.company_name,
        description: job.description,
        location: job.location,
      });
      const { error } = await supabase
        .from("jobs")
        .update({
          dedup_hash: dedupHash,
          remote_region: region,
          is_globally_open: isGloballyOpen,
          possibly_closed: possiblyClosed,
          possibly_closed_reason: possiblyClosedReason,
        })
        .eq("id", job.id);
      if (error) throw error;
      summary.jobsEnriched++;
    } catch (error) {
      console.error(`discover-jobs: enrich failed for job ${job.id}`, error);
      summary.errors.push({ stage: "enrich", jobId: job.id, error: String(error) });
    }
  }

  // --- Step 3: score every (job, active engineer) pairing that has no ----
  // match row yet — again DB-state-driven, not "jobs from this run," so an
  // orphaned job (enriched, never scored) is indistinguishable from one
  // just enriched moments ago. A newly-active engineer is scored once
  // against every job in freshJobs (below) — bounded to the freshness
  // window, not the full historical jobs table — since freshJobs is
  // computed unconditionally before this loop and every engineer's
  // unscoredJobs is filtered from it, never from the unfiltered allJobs.
  const { data: engineers } = await supabase
    .from("engineers")
    .select("id, years_experience, summary, seniority_levels(name)")
    .eq("is_active", true);

  const { data: allJobs } = await supabase
    .from("jobs")
    .select("id, title, company_name, location, description, posted_at, discovered_at");

  // Freshness cutoff is scoped to scoring only (the O(jobs × engineers)
  // cost this exists to control) — enrichment above stays unfiltered by
  // age, since it's a cheap O(jobs) cost. Admin-tunable via app_settings,
  // same fail-closed-to-a-hardcoded-default pattern as the CV upload limits.
  const DEFAULT_FRESHNESS_CUTOFF_DAYS = 7;
  const { data: freshnessSetting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "job_freshness_cutoff_days")
    .maybeSingle();
  const freshnessDays =
    typeof freshnessSetting?.value === "number" ? freshnessSetting.value : DEFAULT_FRESHNESS_CUTOFF_DAYS;
  const freshnessCutoff = new Date(Date.now() - freshnessDays * 24 * 60 * 60 * 1000);
  const freshJobs = (allJobs ?? []).filter(
    (job) => new Date(job.posted_at ?? job.discovered_at) >= freshnessCutoff,
  );

  const { data: existingMatches } = await supabase
    .from("job_engineer_matches")
    .select("job_id, engineer_id, cv_id");

  const matchedTriples = new Set(
    (existingMatches ?? []).map((m) => `${m.job_id}:${m.engineer_id}:${m.cv_id}`),
  );

  const { data: cvRows } = await supabase
    .from("engineer_cvs")
    .select("id, engineer_id")
    .in("engineer_id", (engineers ?? []).map((engineer) => engineer.id));

  const cvsByEngineer = new Map<string, string[]>();
  for (const cv of cvRows ?? []) {
    const list = cvsByEngineer.get(cv.engineer_id) ?? [];
    list.push(cv.id);
    cvsByEngineer.set(cv.engineer_id, list);
  }
  const uncoveredCvIds = (job: { id: string }, engineerId: string): string[] =>
    (cvsByEngineer.get(engineerId) ?? []).filter(
      (cvId) => !matchedTriples.has(`${job.id}:${engineerId}:${cvId}`),
    );

  summary.scoringPendingTotal = (engineers ?? []).reduce((sum, engineer) => {
    const unscoredCount = freshJobs.filter((job) => uncoveredCvIds(job, engineer.id).length > 0).length;
    return sum + unscoredCount;
  }, 0);

  scoringLoop: for (const engineer of engineers ?? []) {
    if (summary.scoringAttempted >= MAX_SCORING_PAIRS_PER_RUN) break scoringLoop;

    const eligibleCvIds = cvsByEngineer.get(engineer.id) ?? [];
    if (eligibleCvIds.length === 0) continue;

    const { data: engineerSkillRows } = await supabase
      .from("engineer_skills")
      .select("skills(name)")
      .eq("engineer_id", engineer.id);

    const engineerContext: EngineerContext = {
      seniorityLevel: engineer.seniority_levels?.name ?? "Unspecified",
      yearsExperience: engineer.years_experience,
      summary: engineer.summary,
      skills: (engineerSkillRows ?? []).map((row) => row.skills?.name).filter((name): name is string => Boolean(name)),
    };

    const unscoredJobs = freshJobs.filter((job) => uncoveredCvIds(job, engineer.id).length > 0);

    for (const job of unscoredJobs) {
      if (summary.scoringAttempted >= MAX_SCORING_PAIRS_PER_RUN) break scoringLoop;
      summary.scoringAttempted++;
      try {
        const jobListing: JobListing = {
          title: job.title,
          companyName: job.company_name,
          description: job.description,
          location: job.location,
        };
        const { score, modelVersion } = await aiClient.scoreRelevance(engineerContext, jobListing);
        for (const cvId of uncoveredCvIds(job, engineer.id)) {
          const { error } = await supabase.rpc("upsert_job_engineer_match", {
            p_job_id: job.id,
            p_engineer_id: engineer.id,
            p_cv_id: cvId,
            p_relevance_score: score,
            p_ai_model_version: modelVersion,
          });
          if (error) throw error;
          summary.matchesWritten++;
        }
      } catch (error) {
        console.error(`discover-jobs: score failed for job ${job.id} / engineer ${engineer.id}`, error);
        summary.errors.push({ stage: "score", jobId: job.id, engineerId: engineer.id, error: String(error) });
      }
    }
  }

  summary.scoringCapped = summary.scoringAttempted >= MAX_SCORING_PAIRS_PER_RUN && summary.scoringAttempted < summary.scoringPendingTotal;

  return summary;
}
