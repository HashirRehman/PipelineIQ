// Module 9 — AiClient interface (all capabilities designed up front; only
// scoreRelevance + extractRemoteRegion ship in MVP, both Module 3 scope —
// see docs/03-technical-implementation-plan.md Section 12).

export type EngineerContext = {
  seniorityLevel: string;
  yearsExperience: number | null;
  summary: string | null;
  skills: string[];
};

// Mirrors a persisted `jobs` row's shape — this is what AiClient methods
// operate on, downstream of the cron's upsert. Not the same as
// lib/job-sources' RawJobListing, which is the pre-DB shape an adapter
// returns before a job row exists.
export type JobListing = {
  title: string;
  companyName: string;
  description: string | null;
  location: string | null;
};

export type LeadContext = {
  notes: string[];
  status: string;
};

export interface AiClient {
  scoreRelevance(
    engineerProfile: EngineerContext,
    job: JobListing,
  ): Promise<{ score: number; modelVersion: string }>;
  extractRemoteRegion(job: JobListing): Promise<{ region: string | null }>;
  summarizeNotes(notes: string[]): Promise<string>;
  suggestFollowUp(leadContext: LeadContext): Promise<string>;
  recommendCv(engineerId: string, job: JobListing): Promise<{ cvId: string; reasoning: string }>;
  detectDuplicateJob(
    candidate: JobListing,
    existing: JobListing[],
  ): Promise<{ isDuplicate: boolean; matchId?: string }>;
}
