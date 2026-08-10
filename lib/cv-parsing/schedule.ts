// Runs the parse after the response is sent, so a Groq outage or rate limit
// can't fail an upload whose file is already stored.
//
// Service-role client because this runs outside the request's auth lifecycle;
// the admin/org check already happened in uploadProfileCv.
import { after } from "next/server";
import { GroqAiClient } from "@/lib/ai/groq-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAndStoreCv, type CvParseTarget } from "./parse-cv";

export function scheduleCvParse(target: CvParseTarget): void {
  after(async () => {
    const outcome = await parseAndStoreCv(createAdminClient(), new GroqAiClient(), target);

    // logging only — parseAndStoreCv already recorded the outcome on the row
    if (outcome.status === "success") {
      console.log(
        `cv-parse: CV ${outcome.cvId} parsed — ${outcome.skillCount} skills, ${outcome.experienceCount} roles`,
      );
    } else {
      console.warn(`cv-parse: CV ${outcome.cvId} failed — ${outcome.error}`);
    }
  });
}
