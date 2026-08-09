// Module 3 — nightly job-discovery orchestration core.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiClient, JobListing, ProfileContext } from "@/lib/ai/client";
import { getJobSourceAdapters } from "@/lib/job-sources/registry";
import type { Database } from "@/lib/supabase/database.types";

type DiscoveryError = {
  stage: "fetch" | "ingest" | "enrich" | "score";
  sourceSlug?: string;
  jobId?: string;
  profileId?: string;
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

const MAX_ENRICHMENT_JOBS_PER_RUN = 30;
const MAX_SCORING_CALLS_PER_RUN = 60;

const CRON_LOCK_ID = "00000000-0000-4000-8000-000000000090";
const STALE_LOCK_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const COOLDOWN_MS = 15 * 60 * 1000;

export type AcquireLockResult =
  | { acquired: true }
  | { acquired: false; reason: "already_running" }
  | { acquired: false; reason: "cooldown"; nextRunAvailableAt: string };

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

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", "Recurso Labs")
    .maybeSingle();
  if (!orgRow) {
    throw new Error("No organization found — apply supabase/seed.sql first.");
  }
  const organizationId = orgRow.id;

  const adapters = await getJobSourceAdapters(supabase);

  for (const adapter of adapters) {
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
              organization_id: organizationId,
              scraper_id: adapter.sourceId,
              external_job_id: listing.externalId,
              title: listing.title,
              company_name: listing.companyName,
              company_location: listing.location ?? null,
              description: listing.description ?? null,
              apply_url: listing.applyUrl,
              is_remote: listing.isRemote ?? null,
              job_posted_at: listing.postedAt?.toISOString() ?? null,
            },
            { onConflict: "scraper_id,external_job_id" },
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

  const { data: unenrichedJobs } = await supabase
    .from("jobs")
    .select("id, title, company_name, company_location, description")
    .is("is_globally_open", null);

  summary.enrichmentPendingTotal = unenrichedJobs?.length ?? 0;
  const enrichmentBatch = (unenrichedJobs ?? []).slice(0, MAX_ENRICHMENT_JOBS_PER_RUN);
  summary.enrichmentCapped = summary.enrichmentPendingTotal > enrichmentBatch.length;

  // enrich jobs with AI by giving the AI job data and determinding required fields 
  // like region, is_globally_open, possibly_closed, possibly_closed_reason
  for (const job of enrichmentBatch) {
    summary.enrichmentAttempted++;
    try {
      const { region, isGloballyOpen, possiblyClosed, possiblyClosedReason } = await aiClient.extractRemoteRegion({
        title: job.title,
        companyName: job.company_name,
        description: job.description,
        location: job.company_location,
      });
      const { error } = await supabase
        .from("jobs")
        .update({
          remote_allowed_region: region,
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

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, organization_id, years_of_experience, summary, seniority_level(name)")
    .eq("is_active", true);

  const { data: allJobs } = await supabase
    .from("jobs")
    .select("id, title, company_name, company_location, description, job_posted_at, created_at, is_globally_open");

  const DEFAULT_FRESHNESS_CUTOFF_DAYS = 7;
  const freshnessDays =
    Number(process.env.JOB_FRESHNESS_CUTOFF_DAYS) || DEFAULT_FRESHNESS_CUTOFF_DAYS;
  const freshnessCutoff = new Date(Date.now() - freshnessDays * 24 * 60 * 60 * 1000);
  const freshJobs = (allJobs ?? []).filter(
    (job) => new Date(job.job_posted_at ?? job.created_at) >= freshnessCutoff,
  );

  const scorableJobs = freshJobs.filter((job) => job.is_globally_open !== false);

  const { data: existingMatches } = await supabase
    .from("job_profile_matches")
    .select("job_id, profile_id, cv_id");

  const matchedTriples = new Set(
    (existingMatches ?? []).map((m) => `${m.job_id}:${m.profile_id}:${m.cv_id}`),
  );

  const { data: cvRows } = await supabase
    .from("profile_cvs")
    .select("id, profile_id")
    .in("profile_id", (profiles ?? []).map((profile) => profile.id));

  const cvsByProfile = new Map<string, string[]>();
  for (const cv of cvRows ?? []) {
    const list = cvsByProfile.get(cv.profile_id) ?? [];
    list.push(cv.id);
    cvsByProfile.set(cv.profile_id, list);
  }
  const uncoveredCvIds = (job: { id: string }, profileId: string): string[] =>
    (cvsByProfile.get(profileId) ?? []).filter(
      (cvId) => !matchedTriples.has(`${job.id}:${profileId}:${cvId}`),
    );

  summary.scoringPendingTotal = (profiles ?? []).reduce((sum, profile) => {
    const unscoredCount = scorableJobs.filter((job) => uncoveredCvIds(job, profile.id).length > 0).length;
    return sum + unscoredCount;
  }, 0);

  scoringLoop: for (const profile of profiles ?? []) {
    if (summary.scoringAttempted >= MAX_SCORING_CALLS_PER_RUN) break scoringLoop;

    const eligibleCvIds = cvsByProfile.get(profile.id) ?? [];
    if (eligibleCvIds.length === 0) continue;

    const profileContext: ProfileContext = {
      seniorityLevel: profile.seniority_level?.name ?? "Unspecified",
      yearsExperience: profile.years_of_experience,
      summary: profile.summary,
      skills: [],
    };

    const unscoredJobs = scorableJobs.filter((job) => uncoveredCvIds(job, profile.id).length > 0);

    // due to vercel hobby plan limits we can't run the api for more than 300s so to be safe we are only running 60 calls per run
    for (const job of unscoredJobs) {
      if (summary.scoringAttempted >= MAX_SCORING_CALLS_PER_RUN) break scoringLoop;
      summary.scoringAttempted++;
      try {
        const jobListing: JobListing = {
          title: job.title,
          companyName: job.company_name,
          description: job.description,
          location: job.company_location,
        };
        const { score, modelVersion } = await aiClient.scoreRelevance(profileContext, jobListing);
        for (const cvId of uncoveredCvIds(job, profile.id)) {
          // Inline upsert (was the upsert_job_profile_match RPC): the cron runs
          // with the service-role client, so no SECURITY DEFINER wrapper needed.
          const { error } = await supabase.from("job_profile_matches").upsert(
            {
              organization_id: profile.organization_id,
              job_id: job.id,
              profile_id: profile.id,
              cv_id: cvId,
              relevance_score: score,
              ai_model_version: modelVersion,
            },
            { onConflict: "job_id,profile_id,cv_id" },
          );
          if (error) throw error;
          summary.matchesWritten++;
        }
      } catch (error) {
        console.error(`discover-jobs: score failed for job ${job.id} / profile ${profile.id}`, error);
        summary.errors.push({ stage: "score", jobId: job.id, profileId: profile.id, error: String(error) });
      }
    }
  }

  summary.scoringCapped = summary.scoringAttempted >= MAX_SCORING_CALLS_PER_RUN && summary.scoringAttempted < summary.scoringPendingTotal;

  return summary;
}
