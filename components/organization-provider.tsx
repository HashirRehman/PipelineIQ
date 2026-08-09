"use client";

import { useEffect } from "react";
import { setOrganizationId } from "@/lib/api/client";

/**
 * Wires the acting user's organization id (resolved server-side in the
 * dashboard layout) into the shared API client, which forwards it on every
 * request (header x-organization-id / ?organizationId=). The store is set
 * during render — parents render before children, so any child's data
 * fetching is guaranteed to see the id — and kept in sync on change.
 */
export function OrganizationProvider({
  organizationId,
  children,
}: {
  organizationId: string | null;
  children: React.ReactNode;
}) {
  if (typeof window !== "undefined") {
    setOrganizationId(organizationId);
  }

  useEffect(() => {
    setOrganizationId(organizationId);
  }, [organizationId]);

  return <>{children}</>;
}
