// Module 9 — AiClient interface (all capabilities designed up front; only
// scoreRelevance + extractRemoteRegion ship in MVP, both Module 3 scope —
// see docs/03-technical-implementation-plan.md Section 12).
import type { ParsedCv } from "@/lib/cv-parsing/parsed-cv";

export type ProfileContext = {
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

export type ParsedJobData = {
  skills: string[];
  technologies: string[];
  experienceYears: number | null;
  salaryRange: string | null;
};

export interface AiClient {
  // Structures a CV's extracted text into the stored parsed_data shape.
  // Takes text, not a file: extraction is lib/cv-parsing/extract-text.ts's
  // job and is deterministic, so this interface stays about the AI step and
  // a provider swap never involves a PDF library.
  parseCv(text: string): Promise<{ parsed: ParsedCv; modelVersion: string }>;
  scoreRelevance(
    profile: ProfileContext,
    job: JobListing,
  ): Promise<{ score: number; modelVersion: string }>;
  extractRemoteRegion(job: JobListing): Promise<{
    region: string | null;
    isGloballyOpen: boolean;
    possiblyClosed: boolean;
    possiblyClosedReason: string | null;
    parsedData?: ParsedJobData | null;
  }>;
  summarizeNotes(notes: string[]): Promise<string>;
  suggestFollowUp(leadContext: LeadContext): Promise<string>;
  recommendCv(profileId: string, job: JobListing): Promise<{ cvId: string; reasoning: string }>;
  detectDuplicateJob(
    candidate: JobListing,
    existing: JobListing[],
  ): Promise<{ isDuplicate: boolean; matchId?: string }>;
}
