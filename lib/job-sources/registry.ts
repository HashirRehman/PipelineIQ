// Module 3 — maps active scrapers rows to their adapter implementation.
// The fresh schema's scrapers table is a name + base_url registry (no slug /
// config / is_active — activation is deleted_at IS NULL), so adapter
// selection is by scraper name and any per-source tuning lives in env vars.
import type { SupabaseClient } from "@supabase/supabase-js";
import { JsearchAdapter } from "./jsearch-adapter";
import type { JobSourceAdapter } from "./types";

// Adding a second source means one new adapter file plus one more branch
// here (and a scrapers row) — nothing else in the module changes.
export async function getJobSourceAdapters(supabase: SupabaseClient): Promise<JobSourceAdapter[]> {
  const { data: scrapers } = await supabase
    .from("scrapers")
    .select("id, name")
    .is("deleted_at", null);

  const adapters: JobSourceAdapter[] = [];

  for (const scraper of scrapers ?? []) {
    if (scraper.name.toLowerCase() === "jsearch") {
      adapters.push(
        new JsearchAdapter(scraper.id, {
          query: process.env.JSEARCH_QUERY,
          work_from_home: process.env.JSEARCH_WORK_FROM_HOME !== "false",
          country: process.env.JSEARCH_COUNTRIES,
        }),
      );
    }
  }

  return adapters;
}