// Module 3/9 — Groq-backed AiClient implementation.
//
// Only scoreRelevance and extractRemoteRegion are real — everything else
// on the AiClient interface is Phase 2 scope (see docs/03 Section 12) and
// throws rather than pretending to work, so this class stays honestly
// type-checked against the full interface without faking capability.
import type { AiClient, EngineerContext, JobListing, LeadContext } from "./client";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_429_RETRIES = 3;

// Groq's real rate-limit body (confirmed against a forced live 429, not
// assumed): {"error":{"message":"Rate limit reached ... Please try again
// in 2s. ...","type":"requests","code":"rate_limit_exceeded"}} — the
// number can be an integer ("2s") or fractional ("1.234s"), so both are
// matched. Returns null (not a guessed default) if Groq's message format
// ever changes and this can't find a number — the caller decides the
// fallback explicitly rather than this function silently making one up.
function parseGroqRetryDelayMs(errorBody: string): number | null {
  const match = errorBody.match(/try again in (\d+(?:\.\d+)?)s/i);
  if (!match) return null;
  return Math.ceil(Number(match[1]) * 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGroqJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set.");
  }

  // Only 429s are retried here — any other failure (4xx, 5xx, network)
  // still fails on the first attempt, same as before this change.
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
      console.warn(
        `Groq 429 rate limit — retry ${attempt}/${MAX_429_RETRIES}, waiting ${waitMs}ms ` +
          `(${parsedDelayMs !== null ? "from Groq's own retry message" : "Groq's message didn't parse, using 1000ms fallback"})`,
      );
      await sleep(waitMs);
      continue;
    }

    throw new Error(`Groq request failed: ${response.status} ${errorText}`);
  }

  // Unreachable — the loop above always either returns or throws.
  throw new Error("Groq request failed: 429 rate limit, retries exhausted.");
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// This engineer skill catalog's "X Js" naming convention ("Node Js",
// "React Js", "Express Js") frequently doesn't literally appear in real
// postings, which more often just say "Node", "React", or "Node.js"
// without a space — a bare substring match on "Node Js" misses "Node.js"
// entirely. Normalizing punctuation away, plus checking the root token
// with a trailing "js" stripped, closes that gap.
function hasLiteralSkillMention(skills: string[], description: string): boolean {
  const normalizedDescription = normalizeForMatch(description);
  return skills.some((skill) => {
    const normalized = normalizeForMatch(skill);
    const root = normalized.endsWith("js") && normalized.length > 2 ? normalized.slice(0, -2) : normalized;
    return normalizedDescription.includes(normalized) || normalizedDescription.includes(root);
  });
}

export class GroqAiClient implements AiClient {
  async scoreRelevance(
    engineerProfile: EngineerContext,
    job: JobListing,
  ): Promise<{ score: number; modelVersion: string }> {
    const systemPrompt =
      "You score how well an engineer's profile matches a job listing for a recruiting platform. " +
      'Respond only with JSON: {"score": <integer 0-100>, "matched_skills": [<engineer skills found ' +
      'explicitly named in the job description>], "rationale": "<one sentence>"}. ' +
      "matched_skills must only include skills from the engineer's own skills list that are explicitly " +
      "named in the job description — this is an extraction task: list only what is literally present " +
      "in the text, not what you infer or assume. " +
      "0 means completely unrelated, 100 means an ideal match on seniority, skills, and experience. " +
      "If the job description names no specific technology, weight seniority/domain match only — " +
      "do not treat the absence of a stack mismatch as a strong positive signal.";

    const userPrompt = [
      `Engineer seniority: ${engineerProfile.seniorityLevel}`,
      `Engineer years of experience: ${engineerProfile.yearsExperience ?? "unknown"}`,
      `Engineer skills: ${engineerProfile.skills.join(", ") || "none listed"}`,
      `Engineer summary: ${engineerProfile.summary ?? "none provided"}`,
      "---",
      `Job title: ${job.title}`,
      `Company: ${job.companyName}`,
      `Location: ${job.location ?? "unspecified"}`,
      `Job description: ${job.description ?? "none provided"}`,
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

    // The model's own extraction is the primary signal; this cheap
    // substring cross-check only serves as a rescue when the model
    // wrongly reports zero matches despite obvious textual evidence — it
    // does not need to be exhaustive, only directionally generous, since
    // both signals must agree there's no evidence before the cap fires.
    const noModelMatch = matchedSkills.length === 0;
    const noTextEvidence = !hasLiteralSkillMention(engineerProfile.skills, job.description ?? "");
    const cappedScore = noModelMatch && noTextEvidence ? Math.min(clampedScore, 55) : clampedScore;

    return { score: cappedScore, modelVersion: GROQ_MODEL };
  }

  async extractRemoteRegion(job: JobListing): Promise<{ region: string | null }> {
    const systemPrompt =
      "You extract the remote-work eligibility region stated in a job posting's description, if any. " +
      'Respond only with JSON: {"region": "<short label such as \'US only\', \'Worldwide\', \'EMEA\'>"} ' +
      'or {"region": null} if the description does not state any eligibility region.';

    const userPrompt = [`Job title: ${job.title}`, `Job description: ${job.description ?? "none provided"}`].join(
      "\n",
    );

    const parsed = await callGroqJson(systemPrompt, userPrompt);
    if (typeof parsed !== "object" || parsed === null || !("region" in parsed)) {
      throw new Error(`extractRemoteRegion: unexpected response shape: ${JSON.stringify(parsed)}`);
    }

    const region = (parsed as { region: unknown }).region;
    return { region: typeof region === "string" ? region : null };
  }

  async summarizeNotes(_notes: string[]): Promise<string> {
    throw new Error("summarizeNotes: not implemented — Phase 2.");
  }

  async suggestFollowUp(_leadContext: LeadContext): Promise<string> {
    throw new Error("suggestFollowUp: not implemented — Phase 2.");
  }

  async recommendCv(_engineerId: string, _job: JobListing): Promise<{ cvId: string; reasoning: string }> {
    throw new Error("recommendCv: not implemented — Phase 2.");
  }

  async detectDuplicateJob(
    _candidate: JobListing,
    _existing: JobListing[],
  ): Promise<{ isDuplicate: boolean; matchId?: string }> {
    throw new Error("detectDuplicateJob: not implemented — Phase 2.");
  }
}
