import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  profileMutationResponse,
  readJsonBody,
} from "@/lib/api/profiles-response";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createProfile } from "@/lib/services/profiles";
import { isAdminRole } from "@/lib/auth/roles";
import {
  createClient,
  getCachedRolePermissions,
  getCachedUser,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type ProfileListApiItem = {
  id: string;
  fullName: string;
  email: string;
  location: string | null;
  isActive: boolean;
  seniority: string | null;
  rateExpectation: number | null;
  rateCurrency: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
};

export type AssignableUser = {
  id: string;
  name: string;
  email: string;
};

export type ProfilesListApiResponse = {
  profiles: ProfileListApiItem[];
  seniorityLevels: {
    id: string;
    name: string;
  }[];
  /** Whether the caller may create/edit/assign/upload for profiles
   * (Admin + BD Manager — the UI's profile-management controls key off this). */
  canManage: boolean;
  assignableUsers: AssignableUser[];
};

export async function GET(request: Request) {
  const user = await getCachedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  // Profiles are Admin + BD Manager; Business Developers get 403 (the UI
  // hides the page and shows an access-denied state).
  const perms = await getCachedRolePermissions();
  if (!perms.canAccessProfiles) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const supabase = await createClient();

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  const [profilesResult, seniorityLevelsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        `
          id,
          full_name,
          email,
          location,
          is_active,
          rate_expectation,
          rate_currency,
          user_id,
          seniority_level(name),
          users(full_name)
        `,
      )
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("full_name"),

    supabase
      .from("seniority_level")
      .select("id, name")
      .order("name"),
  ]);

  const queryError =
    profilesResult.error ?? seniorityLevelsResult.error;

  if (queryError) {
    console.error("api/profiles: query failed", queryError);

    return NextResponse.json(
      { error: "Failed to load profiles." },
      { status: 500 },
    );
  }

  const profiles: ProfileListApiItem[] = (
    profilesResult.data ?? []
  ).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    location: profile.location,
    isActive: profile.is_active,
    seniority: profile.seniority_level?.name ?? null,
    rateExpectation: profile.rate_expectation,
    rateCurrency: profile.rate_currency,
    assignedUserId: profile.user_id,
    assignedUserName: profile.users?.full_name ?? null,
  }));

  // RLS on users exposes the full list to Admins and BD Managers (migration
  // 15's users_select), so profile managers can assign users to profiles.
  // The GET gate above already guarantees canAccessProfiles (Admin + BD
  // Manager). Admins themselves are excluded — they manage profiles, they
  // don't own them (and admins can't be assigned, per the permission model).
  const { data: userRows, error: usersError } = await supabase
    .from("users")
    .select("id, full_name, email, roles(name)")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("full_name");

  if (usersError) {
    console.error("api/profiles: users query failed", usersError);

    return NextResponse.json(
      { error: "Failed to load profiles." },
      { status: 500 },
    );
  }

  const assignableUsers: AssignableUser[] = (userRows ?? [])
    .filter((userRow) => !isAdminRole(userRow.roles?.name))
    .map((userRow) => ({
      id: userRow.id,
      name: userRow.full_name || userRow.email.split("@")[0] || "User",
      email: userRow.email,
    }));

  const response: ProfilesListApiResponse = {
    profiles,
    seniorityLevels: seniorityLevelsResult.data ?? [],
    canManage: perms.canAccessProfiles,
    assignableUsers,
  };

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { body, response: badBody } = await readJsonBody(request);
  if (badBody) {
    return badBody;
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  const result = await createProfile(supabase, org.organizationId, body);

  if (result.success) {
    revalidatePath("/");
  }

  return profileMutationResponse(result);
}
