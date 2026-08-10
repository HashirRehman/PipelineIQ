// Schedules a CV parse to run after the current response is sent.
//
// Why after() and not inline: parsing calls Groq, so doing it inside the
// upload request would make an admin wait on a third-party API to see their
// own upload succeed, and a Groq 429 (this project hits the daily token cap
// often enough to have a section about it in CLAUDE.md) would surface as a
// failed upload even though the file is safely stored. The row is inserted
// 'pending' and filled in moments later.
//
// Why the service-role client: this runs after the response, outside the
// request's auth lifecycle, so a user-scoped client could hit an expired
// token with no way to refresh it. The authorization decision already
// happened in the request — uploadProfileCv is admin-gated and org-scoped
// before this is ever scheduled — and the write is pinned to the single cv id
// it was given. Same reasoning the discovery cron already uses.
import { after } from "next/server";
import { GroqAiClient } from "@/lib/ai/groq-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAndStoreCv, type CvParseTarget } from "./parse-cv";

export function scheduleCvParse(target: CvParseTarget): void {
  after(async () => {
    const outcome = await parseAndStoreCv(createAdminClient(), new GroqAiClient(), target);

    // parseAndStoreCv never throws and records failures on the row, so this
    // log is for operator visibility, not error handling.
    if (outcome.status === "success") {
      console.log(
        `cv-parse: CV ${outcome.cvId} parsed — ${outcome.skillCount} skills, ${outcome.experienceCount} roles`,
      );
    } else {
      console.warn(`cv-parse: CV ${outcome.cvId} failed — ${outcome.error}`);
    }
  });
}
