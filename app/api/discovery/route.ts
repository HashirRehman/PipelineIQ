import { NextRequest, NextResponse } from "next/server";
import { createClient, getCachedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

type JobWithMatches = {
  id: string;
  created_at: string;
  title: string;
  company_name: string;
  company_location: string | null;
  apply_url: string;
  is_remote: boolean | null;
  remote_allowed_region: string | null;
  job_posted_at: string | null;
  description: string | null;
  possibly_closed: boolean | null;
  scrapers: { name: string } | null;
  job_profile_matches: {
    id: string;
    profile_id: string;
    cv_id: string;
    relevance_score: number;
    profile_cvs: { file_name: string } | null;
  }[];
};

export type CvMatch = {
  matchId: string;
  cvId: string;
  cvLabel: string;
  isCurrentCv: boolean;
  relevanceScore: number;
  status: "new";
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
  description: string;
  relevanceScore: number | null;
  cvMatches: CvMatch[];
  possiblyClosed: boolean | null;
  remoteRegion: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  rate_expectation: number | null;
  rate_currency: string;
  years_of_experience: number | null;
  summary: string | null;
  is_active: boolean;
  created_at: string;
  seniority_level: { name: string } | null;
};

export type DiscoveryProfile = {
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
  status: "active" | "inactive";
  createdAt: string;
};

function toDiscoveryProfile(row: ProfileRow): DiscoveryProfile {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    phone: row.phone ?? "",
    location: row.location ?? "",
    seniority: row.seniority_level?.name ?? "",
    yearsExp: row.years_of_experience ?? 0,
    rate: row.rate_expectation ?? 0,
    rateCurrency: row.rate_currency,
    summary: row.summary ?? "",
    status: row.is_active ? "active" : "inactive",
    createdAt: row.created_at,
  };
}

function toDiscoveryJob(
  job: JobWithMatches,
  profileId: string | undefined,
  userCvIds: Set<string>,
  stateByPair: Map<string, "applied" | "dismissed">,
  status: "new" | "applied" | "dismissed",
): DiscoveryJob | null {
  // The default feed ("new") shows only jobs with no applied/dismissed state
  // for the acting profile. A status feed inverts that: it shows exactly the
  // jobs the profile marked applied (or dismissed), dropping the rest.
  const pairStatus = profileId ? stateByPair.get(`${job.id}:${profileId}`) : undefined;
  if (status === "new") {
    if (pairStatus) {
      return null;
    }
  } else if (pairStatus !== status) {
    return null;
  }

  // Only the current user's assigned profile's matches belong in this
  // user's discovery feed — and only for CVs the profile still has. Users
  // with no assigned profile, or whose profile has no CVs, see the job
  // with no match data at all (the jobs are still listed).
  const matches = (job.job_profile_matches ?? []).filter(
    (m) => m.profile_id === profileId && userCvIds.has(m.cv_id),
  );

  const cvMatches: CvMatch[] = matches.map((m) => ({
    matchId: m.id,
    cvId: m.cv_id,
    cvLabel: m.profile_cvs?.file_name ?? "Untitled CV",
    isCurrentCv: false,
    relevanceScore: m.relevance_score,
    status: "new",
  }));

  const bestMatch = cvMatches.reduce<CvMatch | null>(
    (best, cv) => (best === null || cv.relevanceScore > best.relevanceScore ? cv : best),
    null,
  );

  return {
    id: job.id,
    title: job.title,
    company: job.company_name,
    location: job.company_location ?? "",
    workType: job.is_remote ? "remote" : "onsite",
    postedAt: job.job_posted_at ?? job.created_at,
    applyUrl: job.apply_url,
    parser: job.scrapers?.name ?? "",
    status,
    description: job.description ?? "",
    relevanceScore: bestMatch?.relevanceScore ?? null,
    cvMatches,
    possiblyClosed: job.possibly_closed ?? null,
    remoteRegion: job.remote_allowed_region ?? null,
  };
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

  const workType = searchParams.get("workType") ?? "";
  const parser = searchParams.get("parser") ?? "";
  const search = (searchParams.get("search") ?? "").trim();
  const region = searchParams.get("region") ?? "";

  // Feed the jobs are returned as. Defaults to the discovery feed ("new").
  const statusParam = (searchParams.get("status") ?? "new").toLowerCase();
  const status: "new" | "applied" | "dismissed" =
    statusParam === "applied" || statusParam === "dismissed" ? statusParam : "new";

  // A status feed only makes sense against the acting user's assigned profile,
  // so derive it here and pass profileId through once.
  const isStatusFeed = status !== "new";

  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  let organizationId = userRow?.organization_id ?? null;
  if (!organizationId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("name", "Recurso Labs")
      .maybeSingle();
    organizationId = org?.id ?? null;
  }
  if (!organizationId) {
    console.error("api/discovery: no organization resolved for user", user.id);
    return NextResponse.json(
      { error: "No organization found for this account." },
      { status: 500 },
    );
  }

  const [{ data: profileRow }, { data: stateRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, location, rate_expectation, rate_currency, years_of_experience, summary, is_active, created_at, seniority_level(name)",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("job_profile_states")
      .select("job_id, profile_id, status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
  ]);

  // Live CVs of the current user's assigned profile. Match rows for soft-
  // deleted CVs linger in job_profile_matches (FK rows are kept), so matches
  // are filtered down to the profile's current CVs — empty when the user has
  // no assigned profile or no CVs, in which case jobs render match-free.
  const userCvIds = new Set<string>();
  if (profileRow) {
    const { data: cvRows, error: cvError } = await supabase
      .from("profile_cvs")
      .select("id")
      .eq("profile_id", profileRow.id)
      .is("deleted_at", null);

    if (cvError) {
      console.error("api/discovery: profile CVs query failed", cvError);
      return NextResponse.json(
        { error: "Failed to load jobs." },
        { status: 500 },
      );
    }

    for (const cv of cvRows ?? []) {
      userCvIds.add(cv.id);
    }
  }

  const stateByPair = new Map<string, "applied" | "dismissed">();
  for (const s of stateRows ?? []) {
    if (s.status === "applied" || s.status === "dismissed") {
      stateByPair.set(`${s.job_id}:${s.profile_id}`, s.status);
    }
  }

  let query = supabase.from("jobs").select(
    "id, created_at, title, company_name, company_location, apply_url, is_remote, remote_allowed_region, job_posted_at, description, possibly_closed, scrapers(name), job_profile_matches(id, profile_id, cv_id, relevance_score, profile_cvs!cv_id(file_name))",
  )
    .eq("organization_id", organizationId)
    .order("job_posted_at", { ascending: false, nullsFirst: false });

  // Default: only jobs the AI enrichment marked as globally open. "US Only"
  // is exclusive — it shows region-restricted postings (is_globally_open =
  // false) alone, never alongside the worldwide ones. Unenriched jobs (null)
  // stay hidden either way. Applied/dismissed feeds skip this — a job the
  // user already acted on is returned regardless of whether it's still open.
  if (!isStatusFeed) {
    if (region === "us_only") {
      query = query.eq("is_globally_open", false);
    } else {
      query = query.eq("is_globally_open", true);
    }
  }

  if (workType === "remote") {
    query = query.eq("is_remote", true);
  } else if (workType === "onsite") {
    query = query.eq("is_remote", false);
  }

  if (parser && parser !== "All Sources") {
    query = query.eq("scrapers.name", parser);
  }

  if (search) {
    const term = search.replace(/'/g, "''");
    query = query.or(
      `title.ilike.%${term}%,company_name.ilike.%${term}%,company_location.ilike.%${term}%`,
    );
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("api/discovery: query failed", error);
    return NextResponse.json({ error: "Failed to load jobs." }, { status: 500 });
  }

  const jobs = ((rows ?? []) as JobWithMatches[])
    .map((job) => toDiscoveryJob(job, profileRow?.id, userCvIds, stateByPair, status))
    .filter((job): job is DiscoveryJob => job !== null)
    .sort((a, b) => (b.relevanceScore ?? -1) - (a.relevanceScore ?? -1));

  const totalCount = jobs.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = (page - 1) * pageSize;
  const pagedJobs = jobs.slice(offset, offset + pageSize);

  return NextResponse.json({
    jobs: pagedJobs,
    profile: profileRow ? toDiscoveryProfile(profileRow) : null,
    totalCount,
    page,
    pageSize,
    totalPages,
  });
}
