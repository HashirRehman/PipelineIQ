import { NextResponse } from "next/server";
import { ACTIVITY_ACTIONS, type ActivityAction } from "@/lib/api/activity";
import { parseDateWindow } from "@/lib/api/job-filters";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createClient, getCachedRolePermissions, getCachedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 50;

export interface ApiActivity {
  id: string;
  actorUserId: string | null;
  actorName: string;
  action: ActivityAction;
  description: string;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  createdAt: string;
}

export interface ApiActivityUser {
  id: string;
  name: string;
}

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

function parseAction(value: string | null): ActivityAction | null {
  return value && (ACTIVITY_ACTIONS as readonly string[]).includes(value)
    ? (value as ActivityAction)
    : null;
}

export async function GET(request: Request) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Every role has an Activity tab (own actions at minimum) — there is no
  // canAccessActivity gate. What differs is SCOPE: Admin and BD Manager see
  // the whole org's feed; everyone else sees only their own rows. That scope
  // is the RLS boundary (user_activities_select), not an app-layer gate —
  // this filter is a convenience for the "show everyone / just me" toggle,
  // not the security boundary itself.
  const perms = await getCachedRolePermissions();
  const scopedToSelf = perms.userRoleKey === "bd";

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;
  const organizationId = org.organizationId;

  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const search = (searchParams.get("search") ?? "").trim();
  const action = parseAction(searchParams.get("action"));
  // A userId filter is only meaningful for privileged roles (a BD's own rows
  // are already the only ones RLS will ever return) — accepted from anyone,
  // since RLS is the actual boundary and a mismatched value just yields zero
  // rows rather than leaking anything.
  const userId = searchParams.get("userId") ?? "";
  const dateWindow = parseDateWindow(searchParams);

  let query = supabase
    .from("user_activities")
    .select(
      "id, user_id, actor_name, action, description, entity_type, entity_id, entity_label, created_at",
      { count: "exact" },
    )
    .eq("organization_id", organizationId);

  if (scopedToSelf) {
    query = query.eq("user_id", user.id);
  } else if (userId) {
    query = query.eq("user_id", userId);
  }
  if (action) {
    query = query.eq("action", action);
  }
  if (search) {
    // actor_name / description are the only free-text columns worth
    // searching — entity_label is a bonus so a search for a profile or job
    // name still surfaces the row even if the rendered sentence phrases it
    // differently.
    const escaped = search.replace(/[%_]/g, (c) => `\\${c}`);
    query = query.or(
      `description.ilike.%${escaped}%,actor_name.ilike.%${escaped}%,entity_label.ilike.%${escaped}%`,
    );
  }
  if (dateWindow) {
    query = query.gte("created_at", dateWindow.from);
    if (dateWindow.to) query = query.lte("created_at", dateWindow.to);
  }

  const offset = (page - 1) * pageSize;
  query = query.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);

  const { data: rows, error, count } = await query;

  if (error) {
    console.error("api/activity: query failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const activities: ApiActivity[] = (rows ?? []).map((row) => ({
    id: row.id,
    actorUserId: row.user_id,
    actorName: row.actor_name,
    action: row.action as ActivityAction,
    description: row.description,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    createdAt: row.created_at,
  }));

  // The filter dropdown's user list: every org member for privileged roles
  // (any of them could be the actor on a row), just the caller otherwise —
  // matches "only see their own data" applying to the filter vocabulary too
  // (same rule the leads API follows for its profile/user filters).
  let users: ApiActivityUser[];
  if (scopedToSelf) {
    users = [
      {
        id: user.id,
        name: (user.user_metadata?.full_name as string | undefined) || user.email || "You",
      },
    ];
  } else {
    const { data: userRows, error: usersError } = await supabase
      .from("users")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("full_name");

    if (usersError) {
      console.error("api/activity: users query failed", usersError);
    }
    users = (userRows ?? []).map((u) => ({ id: u.id, name: u.full_name || "User" }));
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return NextResponse.json({
    activities,
    users,
    actions: ACTIVITY_ACTIONS,
    canViewAll: !scopedToSelf,
    totalCount,
    page,
    pageSize,
    totalPages,
  });
}
