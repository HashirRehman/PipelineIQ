// Module 3/9 — Groq-backed AiClient implementation.
//
// Only scoreRelevance and extractRemoteRegion are real — everything else
// on the AiClient interface is Phase 2 scope (see docs/03 Section 12) and
// throws rather than pretending to work, so this class stays honestly
// type-checked against the full interface without faking capability.
import type { AiClient, EngineerContext, JobListing, LeadContext } from "./client";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

async function callGroqJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set.");
  }

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

  if (!response.ok) {
    throw new Error(`Groq request failed: ${response.status} ${await response.text()}`);
  }

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

export class GroqAiClient implements AiClient {
  async scoreRelevance(
    engineerProfile: EngineerContext,
    job: JobListing,
  ): Promise<{ score: number; modelVersion: string }> {
    const systemPrompt =
      "You score how well an engineer's profile matches a job listing for a recruiting platform. " +
      'Respond only with JSON: {"score": <integer 0-100>, "rationale": "<one sentence>"}. ' +
      "0 means completely unrelated, 100 means an ideal match on seniority, skills, and experience.";

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
      typeof (parsed as { score?: unknown }).score !== "number"
    ) {
      throw new Error(`scoreRelevance: unexpected response shape: ${JSON.stringify(parsed)}`);
    }

    const score = (parsed as { score: number }).score;
    return { score: Math.max(0, Math.min(100, score)), modelVersion: GROQ_MODEL };
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
