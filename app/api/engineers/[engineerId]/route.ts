import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
    engineerMutationResponse,
    readJsonBody,
} from "@/lib/api/engineers-response";
import { isSameOrigin } from "@/lib/api/guard";
import { updateEngineer } from "@/lib/services/engineers";
import {
    createClient,
    getCachedIsAdmin,
    getCachedUser,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type EngineerDetailApiResponse = {
    engineer: {
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
        skillNames: string;
    };
    assignments: {
        bdUserId: string;
        fullName: string;
        email: string;
    }[];
    bdCandidates: {
        id: string;
        fullName: string;
        email: string;
    }[];
    cvs: {
        id: string;
        label: string;
        fileName: string;
        isCurrent: boolean;
        createdAt: string;
        downloadUrl: string | null;
    }[];
};

export async function GET(
    _request: NextRequest,
    context: {
        params: Promise<{
            engineerId: string;
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

    const { engineerId } = await context.params;

    if (!engineerId) {
        return NextResponse.json(
            { error: "Engineer ID is required." },
            { status: 400 },
        );
    }

    const supabase = await createClient();
    const isAdmin = Boolean(await getCachedIsAdmin());

    const [
        selectedEngineerResult,
        cvRowsResult,
        assignmentsResult,
    ] = await Promise.all([
        supabase
            .from("engineers")
            .select(
                `
          id,
          full_name,
          email,
          phone,
          location,
          seniority_level_id,
          years_experience,
          rate_expectation,
          rate_currency,
          summary,
          is_active,
          seniority_levels(name),
          engineer_skills(skills(name))
        `,
            )
            .eq("id", engineerId)
            .maybeSingle(),

        supabase
            .from("engineer_cvs")
            .select(
                `
          id,
          label,
          file_name,
          storage_path,
          is_current,
          created_at
        `,
            )
            .eq("engineer_id", engineerId)
            .order("created_at", { ascending: false }),

        supabase
            .from("engineer_bd_assignments")
            .select(
                `
          bd_user_id,
          profiles!engineer_bd_assignments_bd_user_id_fkey(
            full_name,
            email
          )
        `,
            )
            .eq("engineer_id", engineerId)
            .is("unassigned_at", null),
    ]);

    const queryError =
        selectedEngineerResult.error ??
        cvRowsResult.error ??
        assignmentsResult.error;

    if (queryError) {
        console.error(
            "api/engineers/[engineerId]: query failed",
            queryError,
        );

        return NextResponse.json(
            { error: "Failed to load engineer profile." },
            { status: 500 },
        );
    }

    const selectedEngineer = selectedEngineerResult.data;

    if (!selectedEngineer) {
        return NextResponse.json(
            { error: "Engineer profile not found." },
            { status: 404 },
        );
    }

    const cvs = await Promise.all(
        (cvRowsResult.data ?? []).map(async (cv) => {
            const { data: signedUrlData, error: signedUrlError } =
                await supabase.storage
                    .from("cv-files")
                    .createSignedUrl(cv.storage_path, 3600);

            if (signedUrlError) {
                console.error(
                    `Failed to create signed URL for CV ${cv.id}`,
                    signedUrlError,
                );
            }

            return {
                id: cv.id,
                label: cv.label,
                fileName: cv.file_name,
                isCurrent: cv.is_current,
                createdAt: cv.created_at,
                downloadUrl: signedUrlData?.signedUrl ?? null,
            };
        }),
    );

    const assignments = (assignmentsResult.data ?? []).map(
        (assignment) => ({
            bdUserId: assignment.bd_user_id,
            fullName:
                assignment.profiles?.full_name ?? "Unknown user",
            email: assignment.profiles?.email ?? "",
        }),
    );

    let bdCandidates: {
        id: string;
        fullName: string;
        email: string;
    }[] = [];

    if (isAdmin) {
        const { data: bdProfiles, error: bdProfilesError } =
            await supabase
                .from("profiles")
                .select(
                    `
            id,
            full_name,
            email,
            user_roles!user_roles_user_id_fkey(
              roles(name)
            )
          `,
                )
                .order("full_name");

        if (bdProfilesError) {
            console.error(
                "api/engineers/[engineerId]: BD profiles query failed",
                bdProfilesError,
            );

            return NextResponse.json(
                { error: "Failed to load assignment options." },
                { status: 500 },
            );
        }

        const assignedIds = new Set(
            assignments.map((assignment) => assignment.bdUserId),
        );

        bdCandidates = (bdProfiles ?? [])
            .filter((profile) =>
                (profile.user_roles ?? []).some(
                    (userRole) =>
                        userRole.roles?.name === "bd_executive",
                ),
            )
            .filter((profile) => !assignedIds.has(profile.id))
            .map((profile) => ({
                id: profile.id,
                fullName: profile.full_name,
                email: profile.email,
            }));
    }

    const skillNames = (
        selectedEngineer.engineer_skills ?? []
    )
        .map((engineerSkill) => engineerSkill.skills?.name ?? "")
        .filter(Boolean)
        .join(", ");

    const response: EngineerDetailApiResponse = {
        engineer: {
            id: selectedEngineer.id,
            fullName: selectedEngineer.full_name,
            email: selectedEngineer.email,
            phone: selectedEngineer.phone,
            location: selectedEngineer.location,
            seniority:
                selectedEngineer.seniority_levels?.name ?? null,
            seniorityLevelId:
                selectedEngineer.seniority_level_id ?? "",
            yearsExperience:
                selectedEngineer.years_experience,
            rateExpectation:
                selectedEngineer.rate_expectation,
            rateCurrency:
                selectedEngineer.rate_currency,
            summary: selectedEngineer.summary,
            isActive: selectedEngineer.is_active,
            skillNames,
        },
        assignments,
        bdCandidates,
        cvs,
    };

    return NextResponse.json(response);
}

export async function PATCH(
    request: NextRequest,
    context: {
        params: Promise<{
            engineerId: string;
        }>;
    },
) {
    if (!isSameOrigin(request)) {
        return NextResponse.json(
            { success: false, error: "Forbidden" },
            { status: 403 },
        );
    }

    const { engineerId } = await context.params;

    const { body, response: badBody } = await readJsonBody(request);
    if (badBody) {
        return badBody;
    }

    const supabase = await createClient();
    const result = await updateEngineer(supabase, engineerId, body);

    if (result.success) {
        revalidatePath("/engineers");
        revalidatePath(`/engineers/${engineerId}`);
    }

    return engineerMutationResponse(result);
}