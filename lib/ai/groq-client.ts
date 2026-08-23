import {
  isUsableParse,
  parsedCvSchema,
  type ParsedCv,
} from "@/lib/cv-parsing/parsed-cv";
import type { AiClient, JobListing, LeadContext, ProfileContext, ParsedJobData } from "./client";

const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_429_RETRIES = 3;

const GROQ_PACE_INTERVAL_MS = 2000;
let lastCallStartedAt = 0;

async function paceCall(): Promise<void> {
  const elapsed = Date.now() - lastCallStartedAt;
  if (elapsed < GROQ_PACE_INTERVAL_MS) {
    await sleep(GROQ_PACE_INTERVAL_MS - elapsed);
  }
  lastCallStartedAt = Date.now();
}

const MAX_RETRY_WAIT_MS = 65_000;

function parseGroqRetryDelayMs(errorBody: string): number | null {
  const match = errorBody.match(/try again in (?:(\d+)m)?(\d+(?:\.\d+)?)s/i);
  if (!match) return null;
  const minutes = match[1] ? Number(match[1]) : 0;
  const seconds = Number(match[2]);
  return Math.ceil((minutes * 60 + seconds) * 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type GroqCallOptions = { maxTokens?: number };

async function callGroqJson(
  systemPrompt: string,
  userPrompt: string,
  options: GroqCallOptions = {},
): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set.");
  }

  await paceCall();

  for (let attempt = 1; attempt <= MAX_429_RETRIES + 1; attempt++) {
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        reasoning_effort: "low",
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      }),
    });

    if (response.ok) {
      const body = await response.json();
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error("Groq response missing message content.");
      }
      try {
        return JSON.parse(content);
      } catch {
        throw new Error(`Groq response was not valid JSON: ${content}`);
      }
    }

    const errorText = await response.text();

    if (response.status === 429 && attempt <= MAX_429_RETRIES) {
      const parsedDelayMs = parseGroqRetryDelayMs(errorText);
      const waitMs = parsedDelayMs ?? 1000;

      if (waitMs > MAX_RETRY_WAIT_MS) {
        console.warn(
          `Groq 429 rate limit — suggested wait ${waitMs}ms exceeds ${MAX_RETRY_WAIT_MS}ms, failing fast ` +
            `instead of retrying (likely the daily token cap, not a per-minute limit).`,
        );
        throw new Error(`Groq request failed: ${response.status} ${errorText}`);
      }

      console.warn(
        `Groq 429 rate limit — retry ${attempt}/${MAX_429_RETRIES}, waiting ${waitMs}ms ` +
          `(${parsedDelayMs !== null ? "from Groq's own retry message" : "Groq's message didn't parse, using 1000ms fallback"})`,
      );
      await sleep(waitMs);
      continue;
    }

    throw new Error(`Groq request failed: ${response.status} ${errorText}`);
  }

  throw new Error("Groq request failed: 429 rate limit, retries exhausted.");
}

const DESCRIPTION_HEAD_CHARS = 1000;
const DESCRIPTION_TAIL_CHARS = 500;
const TRUNCATION_MARKER = "\n...[truncated]...\n";

function truncateDescription(description: string | null): string | null {
  if (!description) return description;
  const budget = DESCRIPTION_HEAD_CHARS + DESCRIPTION_TAIL_CHARS;
  if (description.length <= budget) return description;
  return `${description.slice(0, DESCRIPTION_HEAD_CHARS)}${TRUNCATION_MARKER}${description.slice(-DESCRIPTION_TAIL_CHARS)}`;
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hasLiteralSkillMention(skills: string[], description: string): boolean {
  const normalizedDescription = normalizeForMatch(description);
  return skills.some((skill) => {
    const normalized = normalizeForMatch(skill);
    const root = normalized.endsWith("js") && normalized.length > 2 ? normalized.slice(0, -2) : normalized;
    return normalizedDescription.includes(normalized) || normalizedDescription.includes(root);
  });
}

const CV_TEXT_MAX_CHARS = 12_000;

const CV_PARSE_MAX_OUTPUT_TOKENS = 4_000;

export class GroqAiClient implements AiClient {
  async parseCv(text: string): Promise<{ parsed: ParsedCv; modelVersion: string }> {
    const systemPrompt =
      "You extract structured data from a candidate's CV/resume text for a recruiting platform. " +
      "This is an EXTRACTION task, not an inference task: every value must come from the text. " +
      "Never invent an employer, skill, date, or qualification that is not written there. " +
      "Respond only with JSON in exactly this shape:\n" +
      "{" +
      '"candidate":{"full_name":<string|null>,"email":<string|null>,"phone":<string|null>,' +
      '"location":<string|null>,"links":{"linkedin":<string|null>,"github":<string|null>,"portfolio":<string|null>}},' +
      '"headline":<string|null>,"summary":<string|null>,' +
      '"total_years_experience":<number|null>,"seniority_hint":<string|null>,' +
      '"skills":[<string>],"skill_groups":[{"category":<string>,"skills":[<string>]}],' +
      '"titles":[<string>],"industries":[<string>],' +
      '"experience":[{"company":<string|null>,"title":<string|null>,"location":<string|null>,' +
      '"start_date":<string|null>,"end_date":<string|null>,"is_current":<boolean>,' +
      '"highlights":[<string>],"skills":[<string>]}],' +
      '"education":[{"institution":<string|null>,"degree":<string|null>,"field_of_study":<string|null>,' +
      '"start_date":<string|null>,"end_date":<string|null>}],' +
      '"certifications":[{"name":<string|null>,"issuer":<string|null>,"issued_date":<string|null>,"expires_date":<string|null>}],' +
      '"languages":[{"name":<string|null>,"proficiency":<string|null>}],' +
      '"projects":[{"name":<string|null>,"description":<string|null>,"url":<string|null>,"skills":[<string>]}]' +
      "}\n" +
      '"skills" must be a FLAT list of every distinct technology, tool, and professional skill named ' +
      "anywhere in the CV, including ones mentioned only inside a job or project. Name each skill as the " +
      "CV writes it. Do not group them, and do not put categories in this list.\n" +
      'Dates must be "YYYY-MM", or "YYYY" if the CV gives only a year. Use null for an ongoing role\'s ' +
      'end_date and set is_current true — never write "Present" as a date.\n' +
      "Use null for anything the CV does not state, and [] for a list with no entries. Do not write " +
      '"N/A" or "unknown". total_years_experience is a number of years, stated if the CV states it, ' +
      "otherwise inferred only from the employment dates.";

    const truncated =
      text.length > CV_TEXT_MAX_CHARS ? text.slice(0, CV_TEXT_MAX_CHARS) : text;

    const raw = await callGroqJson(systemPrompt, `CV text:\n${truncated}`, {
      maxTokens: CV_PARSE_MAX_OUTPUT_TOKENS,
    });

    const result = parsedCvSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(
        `parseCv: response did not match the parsed-CV schema: ${result.error.issues
          .slice(0, 3)
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    if (!isUsableParse(result.data)) {
      throw new Error(
        "parseCv: the parse found neither skills nor experience. Refusing to store an empty result.",
      );
    }

    return { parsed: result.data, modelVersion: GROQ_MODEL };
  }

  async scoreRelevance(
    profile: ProfileContext,
    job: JobListing,
  ): Promise<{ score: number; modelVersion: string }> {
    const systemPrompt =
      "You score how well a candidate's profile matches a job listing for a recruiting platform. " +
      'Respond only with JSON: {"score": <integer 0-100>, "matched_skills": [<candidate skills found ' +
      'explicitly named in the job description>], "rationale": "<one sentence>"}. ' +
      "matched_skills must only include skills from the candidate's own skills list explicitly named " +
      "in the job description — an extraction task, list only literal terms present in the text. " +
      "0 means completely unrelated, 100 means an ideal match on seniority, skills, and experience. " +
      "If the job description names no specific technology, weight seniority/domain match only — " +
      "do not treat the absence of a stack mismatch as a strong positive signal.";

    const userPrompt = [
      `Candidate seniority: ${profile.seniorityLevel}`,
      `Candidate years of experience: ${profile.yearsExperience ?? "unknown"}`,
      `Candidate skills: ${profile.skills.join(", ") || "none listed"}`,
      `Candidate summary: ${profile.summary ?? "none provided"}`,
      "---",
      `Job title: ${job.title}`,
      `Company: ${job.companyName}`,
      `Location: ${job.location ?? "unspecified"}`,
      `Job description: ${truncateDescription(job.description) ?? "none provided"}`,
    ].join("\n");

    const parsed = await callGroqJson(systemPrompt, userPrompt);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { score?: unknown }).score !== "number" ||
      !Array.isArray((parsed as { matched_skills?: unknown }).matched_skills)
    ) {
      throw new Error(`scoreRelevance: unexpected response shape: ${JSON.stringify(parsed)}`);
    }

    const score = (parsed as { score: number }).score;
    const matchedSkills = (parsed as { matched_skills: unknown[] }).matched_skills.filter(
      (skill): skill is string => typeof skill === "string",
    );
    const clampedScore = Math.max(0, Math.min(100, score));

    const noModelMatch = matchedSkills.length === 0;
    const noTextEvidence = !hasLiteralSkillMention(profile.skills, job.description ?? "");
    const cappedScore = noModelMatch && noTextEvidence ? Math.min(clampedScore, 55) : clampedScore;

    return { score: cappedScore, modelVersion: GROQ_MODEL };
  }

  async extractRemoteRegion(job: JobListing): Promise<{
    region: string | null;
    isGloballyOpen: boolean;
    possiblyClosed: boolean;
    possiblyClosedReason: string | null;
    parsedData?: ParsedJobData | null;
  }> {
    const systemPrompt =
      "You extract signals and structured metadata from a job posting's description, if present. " +
      'Respond only with JSON: {\n' +
      '  "remote_region": "<short label such as \'US only\', \'Worldwide\', \'EMEA\'>" or null,\n' +
      '  "is_globally_open": <true|false>,\n' +
      '  "possibly_closed": <true|false>,\n' +
      '  "possibly_closed_reason": "<one sentence>" or null,\n' +
      '  "parsed_data": {\n' +
      '    "skills": [<list of professional skills, roles, and core job competencies required>],\n' +
      '    "technologies": [<list of frameworks, databases, libraries, tools, and platforms mentioned>],\n' +
      '    "experience_years": <integer representing minimum required years of experience, or null if not stated>,\n' +
      '    "salary_range": "<parsed salary/compensation info, or null if not stated>"\n' +
      '  }\n' +
      '}. ' +
      "is_globally_open is true only if the posting states no location/citizenship/region restriction on who " +
      "may apply (open worldwide, or never names one) — false whenever a specific country, region, or timezone " +
      "requirement is named (e.g. 'must be US-based', 'EU timezone only'). is_globally_open and possibly_closed " +
      "are independent. " +
      "possibly_closed is true only on explicit fill/closed/no-longer-accepting-applications language, never " +
      "inferred from posting age. possibly_closed_reason must quote or closely paraphrase the " +
      "specific line justifying possibly_closed, and must be null whenever possibly_closed is false. " +
      "In parsed_data, skills and technologies lists should extract literal terms and tech mentioned in the text. " +
      "For experience_years, extract the minimum years of experience if mentioned (e.g., if it says '3+ years', extract 3); " +
      "if multiple requirements exist, default to the lowest explicit requirement or use null if unspecified.";

    const userPrompt = [
      `Job title: ${job.title}`,
      `Job description: ${truncateDescription(job.description) ?? "none provided"}`,
    ].join("\n");

    const rawParsed = await callGroqJson(systemPrompt, userPrompt);
    if (typeof rawParsed !== "object" || rawParsed === null || !("remote_region" in rawParsed)) {
      throw new Error(`extractRemoteRegion: unexpected response shape: ${JSON.stringify(rawParsed)}`);
    }

    const parsed = rawParsed as {
      remote_region: unknown;
      is_globally_open: unknown;
      possibly_closed: unknown;
      possibly_closed_reason: unknown;
      parsed_data?: {
        skills?: unknown[];
        technologies?: unknown[];
        experience_years?: unknown;
        salary_range?: unknown;
      };
    };

    if (typeof parsed.is_globally_open !== "boolean" || typeof parsed.possibly_closed !== "boolean") {
      throw new Error(`extractRemoteRegion: unexpected response shape: ${JSON.stringify(rawParsed)}`);
    }

    let parsedJobData: ParsedJobData | null = null;
    if (parsed.parsed_data && typeof parsed.parsed_data === "object") {
      const p = parsed.parsed_data;
      parsedJobData = {
        skills: Array.isArray(p.skills) ? p.skills.filter((s): s is string => typeof s === "string") : [],
        technologies: Array.isArray(p.technologies) ? p.technologies.filter((t): t is string => typeof t === "string") : [],
        experienceYears: typeof p.experience_years === "number" ? p.experience_years : null,
        salaryRange: typeof p.salary_range === "string" ? p.salary_range : null,
      };
    }

    return {
      region: typeof parsed.remote_region === "string" ? parsed.remote_region : null,
      isGloballyOpen: parsed.is_globally_open,
      possiblyClosed: parsed.possibly_closed,
      possiblyClosedReason: typeof parsed.possibly_closed_reason === "string" ? parsed.possibly_closed_reason : null,
      parsedData: parsedJobData,
    };
  }

  async summarizeNotes(_notes: string[]): Promise<string> {
    throw new Error("summarizeNotes: not implemented — Phase 2.");
  }

  async suggestFollowUp(_leadContext: LeadContext): Promise<string> {
    throw new Error("suggestFollowUp: not implemented — Phase 2.");
  }

  async recommendCv(_profileId: string, _job: JobListing): Promise<{ cvId: string; reasoning: string }> {
    throw new Error("recommendCv: not implemented — Phase 2.");
  }

  async detectDuplicateJob(
    _candidate: JobListing,
    _existing: JobListing[],
  ): Promise<{ isDuplicate: boolean; matchId?: string }> {
    throw new Error("detectDuplicateJob: not implemented — Phase 2.");
  }
}
