import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  profileMutationResponse,
  readJsonBody,
} from "@/lib/api/profiles-response";
import { isSameOrigin } from "@/lib/api/guard";
import { updateProfile } from "@/lib/services/profiles";
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
  cvs: {
    id: string;
    fileName: string;
    createdAt: string;
    downloadUrl: string | null;
  }[];
};

export async function GET(
  _request: NextRequest,
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

  const { profileId } = await context.params;

  if (!profileId) {
    return NextResponse.json(
      { error: "Profile ID is required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

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
      .maybeSingle(),

    supabase
      .from("profile_cvs")
      .select(
        `
          id,
          file_name,
          storage_path,
          created_at
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
  const result = await updateProfile(supabase, profileId, body);

  if (result.success) {
    revalidatePath("/");
  }

  return profileMutationResponse(result);
}
