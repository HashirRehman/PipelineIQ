import { NextRequest, NextResponse } from "next/server";
import { isWithinWindow, parseDateWindow, parseSort } from "@/lib/api/job-filters";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createClient, getCachedRolePermissions, getCachedUser } from "@/lib/supabase/server";
import type { ParsedJobData } from "@/lib/ai/client";
import { parseEngagementType, type EngagementType, type SortOption } from "@/lib/constants";

const DISCOVERY_SORT_OPTIONS: readonly SortOption[] = [
  "relevance",
  "newest",
  "oldest",
  "company_asc",
  "company_desc",
];

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
  engagement_type: EngagementType | null;
  job_posted_at: string | null;
  description: string | null;
  possibly_closed: boolean | null;
  parsed_data: ParsedJobData | null;
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
  /** The assigned profile whose CV produced this match — lets the drawer
   * label each CV row with its owner when a user has several profiles. */
  profileId: string;
  profileName: string;
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
  /** How the job reached us; null on every scraped job. */
  engagementType: EngagementType | null;
  isLead: boolean;
  /** Most recent applied time across the visible applied pairs — the date
   * the applied feed is filtered and sorted by (null on the discovery feed). */
  appliedAt: string | null;
  /** Per-profile state for every profile assigned to the acting user — a
   * job can be new for one profile while applied/dismissed for another, so
   * actions target a subset of these. */
  profiles: JobProfileState[];
  parsedData?: ParsedJobData | null;
};

export type JobProfileState = {
  profileId: string;
  profileName: string;
  status: "new" | "applied" | "dismissed";
  isLead: boolean;
  /** When this profile applied (job_profile_states.created_at) — null when
   * the pair has no applied state. Dated filters on the applied feed use
   * this instead of the job's posting date. */
  appliedAt: string | null;
};

type ProfileRow = {
  id: string;
  user_id: string | null;
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
  /** The user this profile is currently assigned to — drives the coupled
   * profile/user filters (picking a profile narrows the user list to its
   * owner, and vice versa). */
  userId: string | null;
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
    userId: row.user_id ?? null,
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
  profiles: { id: string; full_name: string }[],
  cvIdsByProfile: Map<string, Set<string>>,
  stateByPair: Map<string, { status: "applied" | "dismissed"; appliedAt: string }>,
  leadByPair: Set<string>,
  status: "new" | "applied" | "dismissed",
): DiscoveryJob | null {
  const profileNameById = new Map(profiles.map((p) => [p.id, p.full_name]));
  // Per-profile state for every profile assigned to the acting user. The
  // default feed ("new") shows only jobs with no applied/dismissed state for
  // at least one profile; a status feed inverts that — it shows exactly the
  // jobs at least one profile marked applied (or dismissed).
  const profileStates: JobProfileState[] = profiles.map((p) => {
    const pair = stateByPair.get(`${job.id}:${p.id}`);
    return {
      profileId: p.id,
      profileName: p.full_name,
      status: pair?.status ?? "new",
      isLead: leadByPair.has(`${job.id}:${p.id}`),
      appliedAt: pair?.appliedAt ?? null,
    };
  });

  // A user with no assigned profile still sees the "new" feed (jobs are
  // listed match-free, as before); status feeds need at least one profile
  // with the matching state.
  const inFeed =
    profiles.length === 0
      ? status === "new"
      : status === "new"
        ? profileStates.some((s) => s.status === "new")
        : profileStates.some((s) => s.status === status);
  if (!inFeed) {
    return null;
  }

  // Matches across ALL of the acting user's profiles and their current CVs —
  // different profiles (and CVs) can match the same job, and the drawer
  // aggregates them into one relevance list. Users with no assigned profile,
  // or whose profiles have no CVs, see the job with no match data at all
  // (the jobs are still listed).
  const matches = (job.job_profile_matches ?? []).filter((m) => {
    const cvIds = cvIdsByProfile.get(m.profile_id);
    return cvIds ? cvIds.has(m.cv_id) : false;
  });

  const cvMatches: CvMatch[] = matches.map((m) => ({
    matchId: m.id,
    profileId: m.profile_id,
    profileName: profileNameById.get(m.profile_id) ?? "Profile",
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
    engagementType: job.engagement_type ?? null,
    isLead: profileStates.some((s) => s.isLead),
    // The most recent application across the visible applied pairs.
    appliedAt: profileStates.reduce<string | null>(
      (best, s) =>
        s.status === "applied" && s.appliedAt && (!best || s.appliedAt > best)
          ? s.appliedAt
          : best,
      null,
    ),
    profiles: profileStates,
    parsedData: job.parsed_data,
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

  // Job pages (Discovery / Pipeline / Leads / Statistics) are open to every
  // role; the gate stays as a named helper so a future restricted role only
  // has to change lib/auth/roles.ts.
  const perms = await getCachedRolePermissions();
  if (!perms.canAccessJobs) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  const workType = searchParams.get("workType") ?? "";
  const parser = searchParams.get("parser") ?? "";
  // Unrecognised values fall back to null = no filter, never an error.
  const engagement = parseEngagementType(searchParams.get("engagement"));
  const search = (searchParams.get("search") ?? "").trim();
  const region = searchParams.get("region") ?? "";
  // Country filter — a country name from lib/countries. Matched as a
  // case-insensitive substring of company_location (locations are free
  // text like "Lahore, Pakistan"), same as the search term.
  const country = (searchParams.get("country") ?? "").trim();
  const sort = parseSort(searchParams.get("sort"), DISCOVERY_SORT_OPTIONS, "relevance");

  // Feed the jobs are returned as. Defaults to the discovery feed ("new").
  const statusParam = (searchParams.get("status") ?? "new").toLowerCase();
  const status: "new" | "applied" | "dismissed" =
    statusParam === "applied" || statusParam === "dismissed" ? statusParam : "new";

  // Lead visibility in status feeds (Pipeline): "in_leads" shows only
  // pairs already in the leads pipeline, "all" shows everything, and the
  // default (absent / "") hides lead jobs. The discovery "new" feed is
  // unaffected — lead pairs always carry an applied state, so they never
  // appear there and isLead is always false for its jobs.
  const leadFilter = (searchParams.get("leadFilter") ?? "").toLowerCase();

  // Explicit date window (computed client-side in the user's local time).
  const dateWindow = parseDateWindow(searchParams);

  // Manager/Admin team filters on the Pipeline feed (status feeds only in
  // practice — Discovery never sends them): narrow which profiles' jobs are
  // shown. profileId = one specific profile; userId = every profile assigned
  // to that user. Default (absent) shows all profiles.
  const profileIdParam = searchParams.get("profileId") ?? "";
  const userIdParam = searchParams.get("userId") ?? "";

  // A status feed only makes sense against the acting user's assigned
  // profiles, so derive them here and pass the set through once.
  const isStatusFeed = status !== "new";

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;
  const organizationId = org.organizationId;

  // The profiles the acting user may act on. Admins and BD Managers see and
  // manage EVERY org profile (the drawer's action picker offers "which
  // profile, or all?" across them); Business Developers see only their own
  // assigned profiles. Scoped by the verified org either way.
  let profileQuery = supabase
    .from("profiles")
    .select(
      "id, user_id, full_name, email, phone, location, rate_expectation, rate_currency, years_of_experience, summary, is_active, created_at, seniority_level(name)",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  if (!perms.canAccessProfiles) {
    profileQuery = profileQuery.eq("user_id", user.id);
  }
  profileQuery = profileQuery
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });

  const [{ data: profileRows }, { data: stateRows }, { data: scraperRows }, { data: leadRows }, { data: userRows }, { data: stageRows }] =
    await Promise.all([
      profileQuery,
      supabase
        .from("job_profile_states")
        .select("job_id, profile_id, status, created_at")
        .eq("organization_id", organizationId)
        .is("deleted_at", null),
      // Distinct source names for the filter sidebar (All Sources + scrapers).
      // scrapers is a global reference table (single-tenant), so no org scope.
      supabase
        .from("scrapers")
        .select("name")
        .is("deleted_at", null)
        .order("name"),
      // Live leads per (job, profile) pair — marks jobs already added to the
      // leads pipeline (duplicate-lead rule: one live lead per pair).
      supabase
        .from("leads")
        .select("job_id, profile_id")
        .eq("organization_id", organizationId)
        .is("deleted_at", null),
      // Team members for the Pipeline filter bar (id/name/role). Admins and
      // BD Managers get the full roster to filter by; Business Developers
      // get an empty list (see `users: perms.canViewUsers ? users : []`
      // below — they're already scoped to their own data via profileQuery's
      // user_id filter above).
      supabase
        .from("users")
        .select("id, full_name, roles(name)")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("full_name"),
      // Lead stages for the New Job dialog (the DB list) — the stage the
      // job lands on when added as a lead.
      supabase
        .from("pipeline_stages")
        .select("id, name, order_index")
        .order("order_index"),
    ]);

  // The full roster stays in the response so the filter dropdowns keep every
  // option while the user narrows; only the job computation is scoped below.
  const allProfileRows = profileRows ?? [];

  // Team filters: narrow which profiles' jobs appear. profileId picks one
  // profile; userId picks every profile assigned to that user. Business
  // Developers are already scoped to their own profiles by profileQuery's
  // user_id filter above, so these params can only narrow further — never
  // widen.
  let visibleProfileRows = allProfileRows;
  if (profileIdParam) {
    visibleProfileRows = visibleProfileRows.filter((p) => p.id === profileIdParam);
  }
  if (userIdParam) {
    visibleProfileRows = visibleProfileRows.filter((p) => p.user_id === userIdParam);
  }

  // Current CVs of the acting user's assigned profiles. Match rows for soft-
  // deleted CVs linger in job_profile_matches (FK rows are kept), so matches
  // are filtered down to each profile's current CVs — empty when the user
  // has no assigned profile or no CVs, in which case jobs render match-free.
  const profileIds = visibleProfileRows.map((p) => p.id);
  const cvIdsByProfile = new Map<string, Set<string>>();
  if (profileIds.length > 0) {
    const { data: cvRows, error: cvError } = await supabase
      .from("profile_cvs")
      .select("id, profile_id")
      .in("profile_id", profileIds)
      .is("deleted_at", null);

    if (cvError) {
      console.error("api/discovery: profile CVs query failed", cvError);
      return NextResponse.json(
        { error: "Failed to load jobs." },
        { status: 500 },
      );
    }

    for (const cv of cvRows ?? []) {
      let cvSet = cvIdsByProfile.get(cv.profile_id);
      if (!cvSet) {
        cvSet = new Set();
        cvIdsByProfile.set(cv.profile_id, cvSet);
      }
      cvSet.add(cv.id);
    }
  }

  const stateByPair = new Map<string, { status: "applied" | "dismissed"; appliedAt: string }>();
  for (const s of stateRows ?? []) {
    if (s.status === "applied" || s.status === "dismissed") {
      stateByPair.set(`${s.job_id}:${s.profile_id}`, {
        status: s.status,
        appliedAt: s.created_at,
      });
    }
  }

  const leadByPair = new Set<string>();
  for (const l of leadRows ?? []) {
    leadByPair.add(`${l.job_id}:${l.profile_id}`);
  }

  let query = supabase.from("jobs").select(
    "id, created_at, title, company_name, company_location, apply_url, is_remote, remote_allowed_region, engagement_type, job_posted_at, description, possibly_closed, parsed_data, scrapers(name), job_profile_matches(id, profile_id, cv_id, relevance_score, profile_cvs!cv_id(file_name))",
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

  if (engagement) {
    query = query.eq("engagement_type", engagement);
  }

  if (country) {
    const term = country.replace(/'/g, "''");
    query = query.ilike("company_location", `%${term}%`);
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

  let jobs = ((rows ?? []) as JobWithMatches[])
    .map((job) => toDiscoveryJob(job, visibleProfileRows, cvIdsByProfile, stateByPair, leadByPair, status))
    .filter((job): job is DiscoveryJob => job !== null);

  // Lead visibility only applies to status feeds (Pipeline): the discovery
  // "new" feed shows every open job — nothing is applied there yet, so the
  // default "hide already-leaded pairs" filter would drop everything. This
  // guard is what keeps the new feed intact (see the leadFilter comment
  // above — the old code applied it unconditionally and emptied Discovery).
  if (isStatusFeed) {
    if (leadFilter === "in_leads") {
      jobs = jobs.filter((job) =>
        job.profiles.some((p) => p.status === "applied" && p.isLead),
      );
    } else if (leadFilter !== "all") {
      // Default: a job whose every applied pair is already a lead is hidden
      // from the applied feed (those pairs live on in Leads); a mixed job —
      // applied for one profile but not yet a lead for another — stays.
      jobs = jobs.filter((job) =>
        job.profiles.some((p) => p.status === "applied" && !p.isLead),
      );
    }
  }

  // Date window. The applied feed is dated by WHEN the job was applied
  // (job_profile_states.created_at), not when it was posted; the discovery
  // feed keeps the posting date.
  if (dateWindow) {
    jobs = jobs.filter((job) =>
      isStatusFeed ? isWithinWindow(job.appliedAt, dateWindow) : isWithinWindow(job.postedAt, dateWindow),
    );
  }

  const companyOf = (job: DiscoveryJob) => job.company.toLowerCase();
  switch (sort) {
    case "newest":
      // Applied feed: ordered by when applied; the discovery feed has no
      // appliedAt (null), so it falls back to the posting date.
      jobs = jobs.sort((a, b) => (b.appliedAt ?? b.postedAt).localeCompare(a.appliedAt ?? a.postedAt));
      break;
    case "oldest":
      jobs = jobs.sort((a, b) => (a.appliedAt ?? a.postedAt).localeCompare(b.appliedAt ?? b.postedAt));
      break;
    case "company_asc":
      jobs = jobs.sort((a, b) => companyOf(a).localeCompare(companyOf(b)));
      break;
    case "company_desc":
      jobs = jobs.sort((a, b) => companyOf(b).localeCompare(companyOf(a)));
      break;
    default:
      // Relevance — the discovery feed's default ordering.
      jobs = jobs.sort((a, b) => (b.relevanceScore ?? -1) - (a.relevanceScore ?? -1));
  }

  const totalCount = jobs.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = (page - 1) * pageSize;
  const pagedJobs = jobs.slice(offset, offset + pageSize);

  const parsers = [
    "All Sources",
    ...Array.from(new Set((scraperRows ?? []).map((s) => s.name).filter(Boolean))),
  ];

  // Team roster for the Pipeline filter bar — only meaningful for roles that
  // see everyone's data (Admin / BD Manager from ROLE_PERMISSIONS). Business
  // Developers get an empty list; they're already limited to their own data
  // by profileQuery's user_id filter above. Each user carries the ids of the
  // profiles currently assigned to them, so the profile/user filters can
  // constrain each other client-side.
  const profileIdsByUser = new Map<string, string[]>();
  for (const p of allProfileRows) {
    if (!p.user_id) continue;
    const list = profileIdsByUser.get(p.user_id) ?? [];
    list.push(p.id);
    profileIdsByUser.set(p.user_id, list);
  }
  const users: {
    id: string;
    name: string;
    role: "admin" | "lead" | "bd";
    profileIds: string[];
  }[] = (userRows ?? []).map((u) => {
    const roleName = (u.roles?.name ?? "").toLowerCase();
    const role: "admin" | "lead" | "bd" = roleName.includes("admin")
      ? "admin"
      : roleName.includes("lead") || roleName.includes("manager")
        ? "lead"
        : "bd";
    return { id: u.id, name: u.full_name || u.id, role, profileIds: profileIdsByUser.get(u.id) ?? [] };
  });

  return NextResponse.json({
    jobs: pagedJobs,
    profiles: allProfileRows.map(toDiscoveryProfile),
    users: perms.canViewUsers ? users : [],
    canViewAllData: perms.canViewUsers,
    canEditJobs: perms.canEditJobs,
    totalCount,
    page,
    pageSize,
    totalPages,
    parsers,
    pipelineStages: (stageRows ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      orderIndex: s.order_index,
    })),
  });
}
