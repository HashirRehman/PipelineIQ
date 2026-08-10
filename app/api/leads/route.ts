import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/guard";
import { dateRangeCutoff, parseDateRange, parseSort } from "@/lib/api/job-filters";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { addToLeadsSchema } from "@/lib/validation/schemas";
import type { SortOption } from "@/lib/constants";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 50;

const LEAD_SORT_OPTIONS: readonly SortOption[] = [
  "newest",
  "oldest",
  "company_asc",
  "company_desc",
];

export interface ApiLead {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  jobLocation: string;
  workType: "remote" | "onsite" | "hybrid";
  appliedAt: string;
  status: string;
  profileId: string;
  profileName: string;
  /** Null once the applier's account is deleted (leads stay with the
   * profile; the owner snapshot is unlinked, migration 14). */
  assignedTo: string | null;
  notes: string;
  parser: string;
  applyUrl: string;
}

export interface ApiLeadUser {
  id: string;
  name: string;
  role: "admin" | "lead" | "bd";
}

type LeadRow = {
  id: string;
  applied_at: string;
  job_id: string;
  profile_id: string;
  user_id: string | null;
  pipeline_stage_id: string;
  notes: string;
  jobs: {
    title: string;
    company_name: string;
    company_location: string | null;
    is_remote: boolean | null;
    apply_url: string;
    scrapers: { name: string } | null;
  } | null;
  profiles: { full_name: string } | null;
  users: { full_name: string } | null;
  pipeline_stages: { name: string } | null;
};

function toApiLead(row: LeadRow): ApiLead {
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: row.jobs?.title ?? "Untitled job",
    company: row.jobs?.company_name ?? "",
    jobLocation: row.jobs?.company_location ?? "",
    workType: row.jobs?.is_remote ? "remote" : "onsite",
    appliedAt: row.applied_at,
    status: row.pipeline_stages?.name ?? "",
    profileId: row.profile_id,
    profileName: row.profiles?.full_name ?? "",
    assignedTo: row.user_id ?? null,
    notes: row.notes ?? "",
    parser: row.jobs?.scrapers?.name ?? "",
    applyUrl: row.jobs?.apply_url ?? "",
  };
}

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

export async function GET(request: Request) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;
  const organizationId = org.organizationId;

  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const search = (searchParams.get("search") ?? "").trim().toLowerCase();
  const status = searchParams.get("status") ?? "";
  const profileId = searchParams.get("profileId") ?? "";
  const userId = searchParams.get("userId") ?? "";
  const dateRange = parseDateRange(searchParams.get("dateRange"));
  const sort = parseSort(searchParams.get("sort"), LEAD_SORT_OPTIONS, "newest");

  const [leadsRes, profilesRes, usersRes, stagesRes] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, applied_at, job_id, profile_id, user_id, pipeline_stage_id, notes, jobs(title, company_name, company_location, is_remote, apply_url, scrapers(name)), profiles(full_name), users(full_name), pipeline_stages(name)",
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("full_name"),
    supabase
      .from("users")
      .select("id, full_name, roles(name)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("full_name"),
    supabase.from("pipeline_stages").select("id, name, order_index").order("order_index"),
  ]);

  if (leadsRes.error || profilesRes.error || usersRes.error || stagesRes.error) {
    console.error("api/leads: query failed", {
      leads: leadsRes.error,
      profiles: profilesRes.error,
      users: usersRes.error,
      stages: stagesRes.error,
    });
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const { data: leadRows } = leadsRes;
  const { data: profileRows } = profilesRes;
  const { data: userRows } = usersRes;
  const { data: stageRows } = stagesRes;

  const cutoff = dateRangeCutoff(dateRange);

  let leads = ((leadRows ?? []) as LeadRow[]).filter((row) => {
    const title = row.jobs?.title ?? "";
    const company = row.jobs?.company_name ?? "";
    const profileName = row.profiles?.full_name ?? "";
    const matchSearch =
      !search ||
      title.toLowerCase().includes(search) ||
      company.toLowerCase().includes(search) ||
      profileName.toLowerCase().includes(search);
    const stageName = row.pipeline_stages?.name ?? "";
    const matchStatus = !status || stageName === status;
    const matchProfile = !profileId || row.profile_id === profileId;
    const matchUser = !userId || row.user_id === userId;
    const matchDate = !cutoff || row.applied_at >= cutoff;
    return matchSearch && matchStatus && matchProfile && matchUser && matchDate;
  });

  const companyOf = (row: LeadRow) => (row.jobs?.company_name ?? "").toLowerCase();
  switch (sort) {
    case "oldest":
      leads = leads.sort((a, b) => a.applied_at.localeCompare(b.applied_at));
      break;
    case "company_asc":
      leads = leads.sort((a, b) => companyOf(a).localeCompare(companyOf(b)));
      break;
    case "company_desc":
      leads = leads.sort((a, b) => companyOf(b).localeCompare(companyOf(a)));
      break;
    default:
      leads = leads.sort((a, b) => b.applied_at.localeCompare(a.applied_at));
  }

  const totalCount = leads.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = (page - 1) * pageSize;
  const paged = leads.slice(offset, offset + pageSize);

  const profiles: { id: string; name: string }[] = (profileRows ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
  }));

  const users: ApiLeadUser[] = (userRows ?? []).map((u) => {
    const roleName = (u.roles?.name ?? "").toLowerCase();
    const role: ApiLeadUser["role"] = roleName.includes("admin")
      ? "admin"
      : roleName.includes("lead") || roleName.includes("manager")
        ? "lead"
        : "bd";
    return { id: u.id, name: u.full_name || u.id, role };
  });

  const pipelineStages = (stageRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    orderIndex: s.order_index,
  }));

  return NextResponse.json({
    leads: paged.map(toApiLead),
    users,
    profiles,
    pipelineStages,
    currentUser: { id: user.id, name: user.user_metadata?.full_name ?? user.email ?? "" },
    totalCount,
    page,
    pageSize,
    totalPages,
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = addToLeadsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { jobId, profileIds } = parsed.data;
  const uniqueProfileIds = Array.from(new Set(profileIds));

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;
  const organizationId = org.organizationId;

  // Every requested profile must belong to the caller's org. Each lead's
  // user_id is the permanent owner snapshot of the profile it wraps (the
  // applier), so notes stay writable only by that user (or admins) — the
  // notes check is enforced in the PATCH route.
  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, user_id, full_name")
    .in("id", uniqueProfileIds)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (profileError) {
    console.error("api/leads: profiles query failed", profileError);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  if (!profileRows || profileRows.length !== uniqueProfileIds.length) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  if (profileRows.some((p) => !p.user_id)) {
    return NextResponse.json(
      { error: "This profile has no assigned user — assign one before adding leads." },
      { status: 400 },
    );
  }

  // Cross-org guard: the job must belong to the same org as the profiles
  // (jobs are world-readable under RLS, so scope the reference explicitly).
  const { data: job } = await supabase
    .from("jobs")
    .select("id, organization_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.organization_id !== organizationId) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  // Only applied pairs become leads; the state row also pins applied_at and
  // the job_profile_state_id for the lead.
  const { data: stateRows, error: stateError } = await supabase
    .from("job_profile_states")
    .select("id, created_at, profile_id")
    .eq("job_id", jobId)
    .in("profile_id", uniqueProfileIds)
    .eq("status", "applied")
    .is("deleted_at", null);

  if (stateError) {
    console.error("api/leads: states query failed", stateError);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const stateByProfileId = new Map((stateRows ?? []).map((s) => [s.profile_id, s]));
  if (uniqueProfileIds.some((id) => !stateByProfileId.has(id))) {
    return NextResponse.json(
      { error: "Only jobs marked as applied can be added to leads." },
      { status: 400 },
    );
  }

  // Duplicate-lead rule: at most one live lead per (job, profile) pair —
  // already-lead pairs are skipped (idempotent), every other pair gets one.
  const { data: existingRows } = await supabase
    .from("leads")
    .select("id, profile_id")
    .eq("job_id", jobId)
    .in("profile_id", uniqueProfileIds)
    .is("deleted_at", null);

  const existingProfileIds = new Set((existingRows ?? []).map((l) => l.profile_id));

  const { data: firstStage } = await supabase
    .from("pipeline_stages")
    .select("id, name")
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!firstStage) {
    return NextResponse.json(
      { error: "No pipeline stages configured — apply supabase/seed.sql first." },
      { status: 500 },
    );
  }

  const leadIds: string[] = [];
  for (const profile of profileRows) {
    if (existingProfileIds.has(profile.id)) continue;
    const state = stateByProfileId.get(profile.id);
    if (!state) continue; // guarded above — belt and braces

    const { data: inserted, error: insertError } = await supabase
      .from("leads")
      .insert({
        organization_id: organizationId,
        job_id: job.id,
        profile_id: profile.id,
        job_profile_state_id: state.id,
        user_id: profile.user_id as string,
        pipeline_stage_id: firstStage.id,
        applied_at: state.created_at,
        notes: "",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("api/leads: insert failed", insertError);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }
    leadIds.push(inserted.id);
  }

  return NextResponse.json({ success: true, created: leadIds.length, leadIds });
}
