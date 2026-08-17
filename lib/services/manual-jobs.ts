import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ParsedJobData } from "@/lib/ai/client";
import type { EngagementType } from "@/lib/constants";

/**
 * Shared engine behind the manual job flows (the Pipeline "New Job" dialog
 * and the Excel bulk import). Both routes do the same thing: one job insert,
 * one chosen profile's state row, and — for leads — a lead row wrapping the
 * applied pair with a stage and comment.
 *
 * The route-level work is split so the bulk import can batch the lookups
 * (one scraper query, one profiles query, one stages query) instead of
 * re-querying per row: loadManualJobRefs() once, then prepare + insert per
 * row. The single-job route uses the same refs loader with the same queries.
 */

export type ManualJobInput = {
  title: string;
  company: string;
  location?: string;
  url?: string;
  /** Applied-on date as "YYYY-MM-DD" (local). */
  date: string;
  source?: string;
  /** How the job reached us; undefined leaves jobs.engagement_type null. */
  engagementType?: EngagementType;
  skills?: string[];
  budget?: string;
  expCompensation?: string;
  developer?: string;
  profileId: string;
  state: "applied" | "lead" | "dismissed";
  pipelineStageId?: string;
  comment?: string;
};

export type ManualJobContext = {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  userId: string;
  /** BD (no profile access) may only create jobs for their own profiles. */
  canAccessProfiles: boolean;
};

export type ManualJobRefs = {
  organizationId: string;
  userId: string;
  scraperId: string;
  profileById: Map<string, { id: string; user_id: string | null }>;
  stageIds: ReadonlySet<string>;
};

type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];
type StateInsert = Database["public"]["Tables"]["job_profile_states"]["Insert"];
type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];

/** The three rows to write, minus the ids linking them (added at insert time). */
export type ManualJobPrepared = {
  jobRow: JobInsert;
  stateRow: Omit<StateInsert, "job_id">;
  leadRow: Omit<LeadInsert, "job_id" | "job_profile_state_id"> | null;
};

export type ManualJobError = {
  message: string;
  status: 400 | 404 | 500;
};

/**
 * One batch of lookup queries shared by every row of an import (and the
 * single-job route). Profile scope is applied here so the map only ever
 * contains profiles the caller may create jobs for.
 */
export async function loadManualJobRefs(
  context: ManualJobContext,
): Promise<ManualJobRefs | ManualJobError> {
  const { supabase, organizationId, userId, canAccessProfiles } = context;

  const [{ data: profileRows }, { data: scraper }, { data: stageRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_id")
        .eq("organization_id", organizationId)
        .is("deleted_at", null),
      supabase.from("scrapers").select("id").eq("name", "Manual").maybeSingle(),
      supabase.from("pipeline_stages").select("id"),
    ]);

  if (!scraper) {
    return {
      message:
        "The Manual job source is not configured. Apply the latest migration first.",
      status: 500,
    };
  }

  const profileById = new Map<string, { id: string; user_id: string | null }>();
  for (const row of profileRows ?? []) {
    if (!canAccessProfiles && row.user_id !== userId) continue;
    profileById.set(row.id, { id: row.id, user_id: row.user_id });
  }

  const stageIds = new Set((stageRows ?? []).map((row) => row.id));

  return {
    organizationId,
    userId,
    scraperId: scraper.id,
    profileById,
    stageIds,
  };
}

/**
 * Validates one row's profile / stage against the refs and builds the three
 * insert rows. Everything failure-prone is validated here, BEFORE any write,
 * so a bad row can never leave a half-created job behind.
 */
export function prepareManualJob(
  input: ManualJobInput,
  refs: ManualJobRefs,
): ManualJobPrepared | ManualJobError {
  const profile = refs.profileById.get(input.profileId);
  if (!profile) {
    return { message: "Profile not found.", status: 404 };
  }

  if (input.state === "lead" && !profile.user_id) {
    return {
      message:
        "This profile has no assigned user. Assign one before creating a lead.",
      status: 400,
    };
  }

  if (input.state === "lead" && input.pipelineStageId !== undefined) {
    if (!refs.stageIds.has(input.pipelineStageId)) {
      return { message: "Stage not found.", status: 400 };
    }
  }

  const appliedAt = new Date(`${input.date}T00:00:00`).toISOString();

  const parsedData: ParsedJobData = {
    skills: input.skills ?? [],
    technologies: [],
    experienceYears: null,
    salaryRange: input.expCompensation ?? null,
  };
  if (input.budget) parsedData.budget = input.budget;
  if (input.source) parsedData.source = input.source;
  if (input.developer) parsedData.developer = input.developer;

  let applyUrl = input.url ?? "";
  if (applyUrl && !/^https?:\/\//i.test(applyUrl)) {
    applyUrl = `https://${applyUrl}`;
  }

  const organizationId = refs.organizationId;
  const userId = refs.userId;

  return {
    jobRow: {
      organization_id: organizationId,
      scraper_id: refs.scraperId,
      external_job_id: crypto.randomUUID(),
      title: input.title,
      company_name: input.company,
      company_location: input.location ?? null,
      description: null,
      apply_url: applyUrl,
      is_remote: null,
      remote_allowed_region: null,
      engagement_type: input.engagementType ?? null,
      job_posted_at: appliedAt,
      is_globally_open: true,
      possibly_closed: false,
      parsed_data: parsedData,
    },
    stateRow: {
      organization_id: organizationId,
      profile_id: profile.id,
      status: input.state === "lead" ? "applied" : input.state,
      user_id: profile.user_id ?? userId,
      created_at: appliedAt,
    },
    leadRow:
      input.state === "lead" && input.pipelineStageId !== undefined
        ? {
            organization_id: organizationId,
            profile_id: profile.id,
            pipeline_stage_id: input.pipelineStageId,
            applied_at: appliedAt,
            notes: input.comment ?? "",
            user_id: profile.user_id as string,
          }
        : null,
  };
}

/**
 * The three sequential inserts that materialize a prepared manual job: the
 * jobs row, the chosen profile's state row, then the lead row when the job
 * is a lead. Returns the new job id or a transient-error message.
 */
export async function insertManualJob(
  context: ManualJobContext,
  prepared: ManualJobPrepared,
): Promise<{ ok: true; jobId: string } | { ok: false; message: string }> {
  const { supabase } = context;

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert(prepared.jobRow)
    .select("id")
    .single();
  if (jobError) {
    console.error("manual-job: job insert failed", jobError);
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  const stateRow: StateInsert = { ...prepared.stateRow, job_id: job.id };
  const { data: state, error: stateError } = await supabase
    .from("job_profile_states")
    .insert(stateRow)
    .select("id")
    .single();
  if (stateError) {
    console.error("manual-job: state insert failed", stateError);
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  if (prepared.leadRow) {
    const leadRow: LeadInsert = {
      ...prepared.leadRow,
      job_id: job.id,
      job_profile_state_id: state.id,
    };
    const { error: leadError } = await supabase
      .from("leads")
      .insert(leadRow);
    if (leadError) {
      console.error("manual-job: lead insert failed", leadError);
      return { ok: false, message: "Something went wrong. Please try again." };
    }
  }

  return { ok: true, jobId: job.id };
}
