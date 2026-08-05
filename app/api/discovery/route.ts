import { NextRequest, NextResponse } from "next/server";
import { createClient, getCachedIsAdmin, getCachedUser } from "@/lib/supabase/server";

// Discovery feed — the client-facing counterpart to the main app
// page. Query runs with the user's RLS-scoped client (the jobs_select /
// job_engineer_matches_select policies scope BD visibility, same as the old
// server-rendered page). The admin score floor below is the same deliberate
// BD-only filter the page used: Admin's view stays unfiltered for QA.
//
// Scope: engineerId is required and filters job_engineer_matches to a single
// engineer — the tab only ever renders the currently active profile's matches,
// never the whole company's. RLS still independently restricts a BD to the
// engineers actually assigned to them.
//
// job_engineer_matches is one row per (job, engineer, cv) — an engineer can
// have several CVs, each scored independently against the same job. This
// route groups those rows by job before paginating, so the client sees one
// card per job (not one per CV) with a per-CV breakdown attached.
export const dynamic = "force-dynamic";

const DEFAULT_MIN_RELEVANCE_SCORE = 60;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const VALID_STATUSES: readonly ("suggested" | "applied" | "dismissed")[] = [
  "suggested",
  "applied",
  "dismissed",
];

type MatchRow = {
  id: string;
  created_at: string;
  relevance_score: number;
  status: "suggested" | "applied" | "dismissed";
  dismissed_reason: string | null;
  cv_id: string;
  engineer_cvs: { label: string; is_current: boolean } | null;
  engineers: { full_name: string | null } | null;
  jobs: {
    id: string;
    title: string;
    company_name: string;
    location: string | null;
    apply_url: string;
    is_remote: boolean | null;
    remote_region: string | null;
    posted_at: string | null;
    description: string | null;
    possibly_closed: boolean | null;
    job_sources: { name: string } | null;
  } | null;
};

export type CvMatch = {
  matchId: string;
  cvId: string;
  cvLabel: string;
  isCurrentCv: boolean;
  relevanceScore: number;
  status: "new" | "applied" | "dismissed";
  dismissReason?: string;
};

export type DiscoveryJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  workType: "remote" | "onsite";
  postedAt: string;
  applyUrl: string;
  parser: string;
  status: "new" | "applied" | "dismissed";
  dismissReason?: string;
  description: string;
  relevanceScore: number;
  cvMatches: CvMatch[];
  possiblyClosed: boolean | null;
  remoteRegion: string | null;
};

type EngineerRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  rate_expectation: number | null;
  rate_currency: string;
  years_experience: number | null;
  summary: string | null;
  is_active: boolean;
  created_at: string;
  seniority_levels: { name: string } | null;
  engineer_skills: { skills: { name: string } | null }[] | null;
};

// Mirrors the SPA's Profile shape so the tab can pass this straight to the
// JobDrawer as the active profile — the engineer whose matches we're showing.
export type DiscoveryEngineer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  seniority: string;
  yearsExp: number;
  rate: number;
  rateCurrency: string;
  summary: string;
  skills: string[];
  status: "active" | "inactive";
  assignedBDs: string[];
  cvLabels: string[];
  createdAt: string;
};

function toDiscoveryEngineer(row: EngineerRow): DiscoveryEngineer {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    phone: row.phone ?? "",
    location: row.location ?? "",
    seniority: row.seniority_levels?.name ?? "",
    yearsExp: row.years_experience ?? 0,
    rate: row.rate_expectation ?? 0,
    rateCurrency: row.rate_currency,
    summary: row.summary ?? "",
    skills: (row.engineer_skills ?? [])
      .map((es) => es.skills?.name ?? "")
      .filter((name) => name.length > 0),
    status: row.is_active ? "active" : "inactive",
    assignedBDs: [],
    cvLabels: [],
    createdAt: row.created_at,
  };
}

function toCvMatchStatus(status: MatchRow["status"]): CvMatch["status"] {
  return status === "applied" ? "applied" : status === "dismissed" ? "dismissed" : "new";
}

// One job can back several match rows (one per CV) — group before turning
// each group into a single card. relevanceScore/status are derived from the
// group, not copied from any one row: relevanceScore is the best (max)
// score across CVs (a BD scanning the list wants "is there any angle that
// works," not a score diluted by a weaker/older CV); status is "applied" if
// any CV match is applied, else "dismissed" only if every CV match is
// dismissed, else "new".
function groupIntoDiscoveryJobs(rows: MatchRow[]): DiscoveryJob[] {
  const byJobId = new Map<string, MatchRow[]>();
  for (const row of rows) {
    if (!row.jobs) continue;
    const list = byJobId.get(row.jobs.id) ?? [];
    list.push(row);
    byJobId.set(row.jobs.id, list);
  }

  return Array.from(byJobId.values()).map((groupRows) => {
    const job = groupRows[0].jobs!;
    const cvMatches: CvMatch[] = groupRows.map((row) => ({
      matchId: row.id,
      cvId: row.cv_id,
      cvLabel: row.engineer_cvs?.label ?? "Untitled CV",
      isCurrentCv: row.engineer_cvs?.is_current ?? false,
      relevanceScore: row.relevance_score,
      status: toCvMatchStatus(row.status),
      dismissReason: row.dismissed_reason ?? undefined,
    }));

    const bestMatch = cvMatches.reduce((best, cv) => (cv.relevanceScore > best.relevanceScore ? cv : best));
    const status: DiscoveryJob["status"] = cvMatches.some((cv) => cv.status === "applied")
      ? "applied"
      : cvMatches.every((cv) => cv.status === "dismissed")
        ? "dismissed"
        : "new";

    return {
      id: job.id,
      title: job.title,
      company: job.company_name,
      location: job.location ?? "",
      workType: job.is_remote ? "remote" : "onsite",
      postedAt: job.posted_at ?? groupRows[0].created_at,
      applyUrl: job.apply_url,
      parser: job.job_sources?.name ?? "",
      status,
      dismissReason: status === "dismissed" ? bestMatch.dismissReason : undefined,
      description: job.description ?? "",
      relevanceScore: bestMatch.relevanceScore,
      cvMatches,
      possiblyClosed: job.possibly_closed ?? null,
      remoteRegion: job.remote_region ?? null,
    };
  });
}

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  const status = searchParams.get("status") ?? "";
  const workType = searchParams.get("workType") ?? "";
  const parser = searchParams.get("parser") ?? "";
  const search = (searchParams.get("search") ?? "").trim();
  const engineerId = (searchParams.get("engineerId") ?? "").trim();

  if (!engineerId) {
    return NextResponse.json({ error: "engineerId is required." }, { status: 400 });
  }

  // Admin-tunable BD score floor, same pattern + fail-closed default as the
  // server-rendered page. isAdmin and the setting are independent — fetched
  // concurrently, along with the engineer whose matches this feed is scoped to.
  const [isAdmin, { data: minScoreSetting }, { data: engineerRow }] = await Promise.all([
    getCachedIsAdmin(),
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "discovery_min_relevance_score")
      .maybeSingle(),
    supabase
      .from("engineers")
      .select(
        "id, full_name, email, phone, location, rate_expectation, rate_currency, years_experience, summary, is_active, created_at, seniority_levels(name), engineer_skills(skills(name))",
      )
      .eq("id", engineerId)
      .maybeSingle(),
  ]);
  const minRelevanceScore =
    typeof minScoreSetting?.value === "number" ? minScoreSetting.value : DEFAULT_MIN_RELEVANCE_SCORE;

  // No DB-level .range() here — grouping by job has to happen in
  // application code first (see groupIntoDiscoveryJobs), so pagination is
  // applied after grouping, below. This fetches every match row for the
  // engineer up front; fine at this app's current scale (bounded by "jobs
  // an engineer has been scored against"), but would need to move to a
  // Postgres-side rollup if that number ever gets large.
  //
  // RLS does all row-level role scoping; jobs!inner (not a plain embed) is
  // required for the .eq("jobs...") filters below to apply to the join, same
  // rationale as the old page. The relevance floor is applied per CV match
  // row, before grouping — a job surfaces if at least one of its CVs clears
  // the floor.
  let query = supabase
    .from("job_engineer_matches")
    .select(
      "id, created_at, relevance_score, status, dismissed_reason, cv_id, engineer_cvs!cv_id(label, is_current), engineers(full_name), jobs!inner(id, title, company_name, location, apply_url, is_remote, remote_region, posted_at, description, possibly_closed, job_sources(name))",
    )
    .eq("engineer_id", engineerId)
    .eq("jobs.is_globally_open", true)
    .order("relevance_score", { ascending: false });

  if (!isAdmin) {
    query = query.gte("relevance_score", minRelevanceScore);
  }

  if (workType === "remote") {
    query = query.eq("jobs.is_remote", true);
  } else if (workType === "onsite") {
    query = query.eq("jobs.is_remote", false);
  }

  if (parser && parser !== "All Sources") {
    query = query.eq("jobs.job_sources.name", parser);
  }

  if (search) {
    // Single-quote doubling keeps a user's search term from breaking the
    // PostgREST filter string; stray commas/parens only yield zero results.
    const term = search.replace(/'/g, "''");
    query = query.or(`title.ilike.%${term}%,company_name.ilike.%${term}%,location.ilike.%${term}%`, {
      foreignTable: "jobs",
    });
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("api/discovery: query failed", error);
    return NextResponse.json({ error: "Failed to load jobs." }, { status: 500 });
  }

  let jobs = groupIntoDiscoveryJobs((rows ?? []) as MatchRow[]);

  // status is derived per job from its CV matches (see
  // groupIntoDiscoveryJobs), so this filter must run post-grouping rather
  // than as a query-level .eq() on the raw match rows.
  if ((VALID_STATUSES as readonly string[]).includes(status)) {
    const wantedStatus = status === "suggested" ? "new" : (status as "applied" | "dismissed");
    jobs = jobs.filter((job) => job.status === wantedStatus);
  }

  const totalCount = jobs.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = (page - 1) * pageSize;
  const pagedJobs = jobs.slice(offset, offset + pageSize);

  return NextResponse.json({
    jobs: pagedJobs,
    engineer: engineerRow ? toDiscoveryEngineer(engineerRow) : null,
    totalCount,
    page,
    pageSize,
    totalPages,
  });
}
