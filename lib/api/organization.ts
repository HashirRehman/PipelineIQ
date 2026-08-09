// Organization-aware API guard.
//
// Every org-scoped route requires the client to pass its organization id
// (header `x-organization-id`, or `?organizationId=` on GETs) and then
// verifies it against the acting user's own `users.organization_id` row.
// A mismatch (or a missing id) is rejected up front, so a caller can never
// scope a query to — or mutate — another organization's resources.
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const ORGANIZATION_ID_HEADER = "x-organization-id";

/** Reads the org id the client supplied: header first, then ?organizationId=. */
export function readOrganizationId(request: Request): string | null {
  const fromHeader = request.headers.get(ORGANIZATION_ID_HEADER);
  if (fromHeader) return fromHeader;
  try {
    return new URL(request.url).searchParams.get("organizationId");
  } catch {
    return null;
  }
}

export type OrganizationAccess =
  | { ok: true; organizationId: string }
  | { ok: false; response: NextResponse };

/**
 * Verifies that the org id supplied by the client is the acting user's own
 * organization (users.organization_id). Callers must short-circuit on a
 * non-ok result. The verified id is returned so routes scope every query
 * with it — never trust a client-supplied id beyond this gate.
 */
export async function verifyOrganizationAccess(
  request: Request,
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<OrganizationAccess> {
  const supplied = readOrganizationId(request);
  if (!supplied) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Organization ID is required." },
        { status: 400 },
      ),
    };
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (!userRow?.organization_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No organization found for this account." },
        { status: 500 },
      ),
    };
  }

  if (userRow.organization_id !== supplied) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not authorized for this organization." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, organizationId: supplied };
}
