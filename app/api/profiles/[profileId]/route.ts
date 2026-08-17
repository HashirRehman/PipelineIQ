import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  profileMutationResponse,
  readJsonBody,
} from "@/lib/api/profiles-response";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import type { ParsedCv } from "@/lib/cv-parsing/parsed-cv";
import { archiveProfile, updateProfile } from "@/lib/services/profiles";
import {
  createClient,
  getCachedUser,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type ProfileDetailApiResponse = {
  profile: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    location: string | null;
    seniority: string | null;
    seniorityLevelId: string;
    yearsExperience: number | null;
    rateExpectation: number | null;
    rateCurrency: string;
    summary: string | null;
    isActive: boolean;
    assignedUserId: string | null;
    assignedUserName: string | null;
  };
  cvs: ProfileCvEntry[];
};

/**
 * A CV plus its parse state.
 *
 * `parsed` is only ever populated when `parseStatus` is 'success'. A failed
 * re-parse keeps the previous good parse on the row (see parse-cv.ts), so a
 * 'failed' CV can still have data worth showing — the UI shows the error
 * alongside it rather than hiding one behind the other.
 */
export type ProfileCvEntry = {
  id: string;
  fileName: string;
  createdAt: string;
  downloadUrl: string | null;
  parseStatus: "pending" | "success" | "failed";
  parseError: string | null;
  parsedAt: string | null;
  parsed: ParsedCv | null;
};

const PARSE_STATUSES = new Set(["pending", "success", "failed"]);

/** The column is plain text in Postgres; narrow it rather than trusting it. */
function toParseStatus(value: string): ProfileCvEntry["parseStatus"] {
  return PARSE_STATUSES.has(value) ? (value as ProfileCvEntry["parseStatus"]) : "pending";
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      profileId: string;
    }>;
  },
) {
  const user = await getCachedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const supabase = await createClient();

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  const { profileId } = await context.params;

  if (!profileId) {
    return NextResponse.json(
      { error: "Profile ID is required." },
      { status: 400 },
    );
  }

  const [
    selectedProfileResult,
    cvRowsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        `
          id,
          full_name,
          email,
          phone,
          location,
          seniority_level_id,
          years_of_experience,
          rate_expectation,
          rate_currency,
          summary,
          is_active,
          user_id,
          seniority_level(name),
          users(full_name)
        `,
      )
      .eq("id", profileId)
      .eq("organization_id", org.organizationId)
      .maybeSingle(),

    supabase
      .from("profile_cvs")
      .select(
        `
          id,
          file_name,
          storage_path,
          created_at,
          parse_status,
          parse_error,
          parsed_at,
          parsed_data
        `,
      )
      .eq("profile_id", profileId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const queryError =
    selectedProfileResult.error ?? cvRowsResult.error;

  if (queryError) {
    console.error(
      "api/profiles/[profileId]: query failed",
      queryError,
    );

    return NextResponse.json(
      { error: "Failed to load profile." },
      { status: 500 },
    );
  }

  const selectedProfile = selectedProfileResult.data;

  if (!selectedProfile) {
    return NextResponse.json(
      { error: "Profile not found." },
      { status: 404 },
    );
  }

  const cvs = (cvRowsResult.data ?? []).map((cv) => {
    const isCloudinaryUrl = cv.storage_path.startsWith(
      "https://res.cloudinary.com",
    );
    return {
      id: cv.id,
      fileName: cv.file_name,
      createdAt: cv.created_at,
      // storage_path holds the Cloudinary CDN URL for uploaded CVs; seeded
      // rows carry dummy paths (not URLs), so they get no download link.
      // fl_attachment forces a download rather than opening the file inline.
      downloadUrl: isCloudinaryUrl
        ? cv.storage_path.replace("/upload/", "/upload/fl_attachment/")
        : null,
      parseStatus: toParseStatus(cv.parse_status),
      parseError: cv.parse_error,
      parsedAt: cv.parsed_at,
      // Validated by parsedCvSchema before it was ever written, so this cast
      // reflects a guarantee the write path already enforced.
      parsed: (cv.parsed_data as ParsedCv | null) ?? null,
    };
  });

  const response: ProfileDetailApiResponse = {
    profile: {
      id: selectedProfile.id,
      fullName: selectedProfile.full_name,
      email: selectedProfile.email,
      phone: selectedProfile.phone,
      location: selectedProfile.location,
      seniority: selectedProfile.seniority_level?.name ?? null,
      seniorityLevelId: selectedProfile.seniority_level_id ?? "",
      yearsExperience: selectedProfile.years_of_experience,
      rateExpectation: selectedProfile.rate_expectation,
      rateCurrency: selectedProfile.rate_currency,
      summary: selectedProfile.summary,
      isActive: selectedProfile.is_active,
      assignedUserId: selectedProfile.user_id,
      assignedUserName: selectedProfile.users?.full_name ?? null,
    },
    cvs,
  };

  return NextResponse.json(response);
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      profileId: string;
    }>;
  },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const { profileId } = await context.params;

  const { body, response: badBody } = await readJsonBody(request);
  if (badBody) {
    return badBody;
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  const result = await updateProfile(supabase, profileId, org.organizationId, body);

  if (result.success) {
    revalidatePath("/");
  }

  return profileMutationResponse(result);
}

// Soft-deletes the profile (sets deleted_at); the is_active column is left
// untouched. Every read filters deleted_at IS NULL, so an archived profile
// disappears from lists, discovery, and dashboards right away.
export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      profileId: string;
    }>;
  },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const { profileId } = await context.params;

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  const result = await archiveProfile(supabase, profileId, org.organizationId);

  if (result.success) {
    revalidatePath("/");
  }

  return profileMutationResponse(result);
}
