// Query keys, defined once. Hierarchical so a mutation can invalidate an area
// by prefix without knowing every filter combination in play.
import { getOrganizationId } from "./client";

function org(): string {
  return getOrganizationId() ?? "no-org";
}

export const queryKeys = {
  profiles: {
    all: () => ["profiles", org()] as const,
    list: () => ["profiles", org(), "list"] as const,
    detail: (profileId: string) => ["profiles", org(), "detail", profileId] as const,
  },

  // Discovery and Applied Jobs both read /api/discovery, so they share the
  // "jobs" prefix — applying to a job in one changes the other.
  jobs: {
    all: () => ["jobs", org()] as const,
    discovery: (params: string) => ["jobs", org(), "discovery", params] as const,
    applied: (params: string) => ["jobs", org(), "applied", params] as const,
    // Reads the same underlying applied pairs as the applied feed — shares
    // the jobs prefix so an apply/dismiss mutation refreshes both.
    applications: () => ["jobs", org(), "applications"] as const,
  },

  leads: {
    all: () => ["leads", org()] as const,
    list: (params: string) => ["leads", org(), "list", params] as const,
  },

  users: {
    all: () => ["users", org()] as const,
    list: () => ["users", org(), "list"] as const,
  },

  pipelineStages: {
    all: () => ["pipeline-stages", org()] as const,
    list: () => ["pipeline-stages", org(), "list"] as const,
  },

  jobComments: {
    all: () => ["job-comments", org()] as const,
    forJob: (jobId: string) => ["job-comments", org(), jobId] as const,
  },
} as const;
