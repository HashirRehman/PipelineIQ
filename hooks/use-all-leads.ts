"use client";

// The Dashboard and Statistics tabs both need the WHOLE pipeline — every
// lead, every page — to aggregate across pages (funnels, leaderboards,
// weekly counts). This hook owns that fetch: page 1 reveals totalPages, the
// remaining pages are independent so they're fetched in parallel, and the
// result is cached under queryKeys.leads.all() — the same key every leads
// mutation invalidates, so both tabs always reflect writes made elsewhere.
//
// It also reads /api/profiles for the active-profile stat card, sharing the
// cache with the Profiles tab (queryKeys.profiles.list()), so profile
// mutations refresh the dashboard too. Business Developers get 403 from that
// route; their card counts their own profiles from the scoped leads response
// instead, so the query is only enabled for roles that may read it.
import { useQuery } from "@tanstack/react-query";
import type { ApiLead, ApiLeadUser } from "@/app/api/leads/route";
import type { ProfilesListApiResponse } from "@/app/api/profiles/route";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

const LEADS_PAGE_SIZE = 50;

/** One page of the leads route — what the dashboard tabs need from it. */
interface AllLeadsPage {
  leads: ApiLead[];
  users: ApiLeadUser[];
  profiles: { id: string; name: string; userId: string | null }[];
  pipelineStages: {
    id: string;
    name: string;
    orderIndex: number;
    state: "active" | "paused" | "closed";
  }[];
  currentUser: { id: string; name: string };
  totalPages: number;
}

interface AllLeadsPayload {
  leads: ApiLead[];
  users: ApiLeadUser[];
  profiles: AllLeadsPage["profiles"];
  stages: AllLeadsPage["pipelineStages"];
  currentUser: { id: string; name: string } | null;
}

async function fetchAllLeads(signal?: AbortSignal): Promise<AllLeadsPayload> {
  // The route caps pageSize at 50 — walk every page, first page first so
  // totalPages is known before the parallel fetch of the rest.
  const first = await apiGet<AllLeadsPage>(
    `/api/leads?page=1&pageSize=${LEADS_PAGE_SIZE}&dateRange=all&sort=newest`,
    signal,
  );
  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) =>
      apiGet<AllLeadsPage>(
        `/api/leads?page=${i + 2}&pageSize=${LEADS_PAGE_SIZE}&dateRange=all&sort=newest`,
        signal,
      ),
    ),
  );
  return {
    leads: [first, ...rest].flatMap((page) => page.leads),
    users: first.users,
    profiles: first.profiles,
    stages: first.pipelineStages,
    currentUser: first.currentUser,
  };
}

export function useAllLeads() {
  const leadsQuery = useQuery({
    queryKey: queryKeys.leads.all(),
    queryFn: ({ signal }) => fetchAllLeads(signal),
  });

  const leads = leadsQuery.data?.leads ?? [];
  const users = leadsQuery.data?.users ?? [];
  const profiles = leadsQuery.data?.profiles ?? [];
  const stages = leadsQuery.data?.stages ?? [];
  const currentUser = leadsQuery.data?.currentUser ?? null;

  // App-facing role of the signed-in user ("admin" | "lead" | "bd"). The
  // leads API scopes BDs to their own leads, so the admin/manager view shows
  // the whole org and the BD view shows their own pipeline.
  const roleKey = users.find((u) => u.id === currentUser?.id)?.role ?? "bd";

  const profilesQuery = useQuery({
    queryKey: queryKeys.profiles.list(),
    queryFn: ({ signal }) =>
      apiGet<ProfilesListApiResponse>("/api/profiles", signal),
    enabled: roleKey !== "bd",
  });

  const activeProfileCount =
    profilesQuery.data?.profiles.filter((p) => p.isActive).length ?? 0;

  return {
    leads,
    users,
    profiles,
    stages,
    currentUser,
    roleKey,
    activeProfileCount,
    isPending: leadsQuery.isPending,
    error: leadsQuery.error,
  };
}
