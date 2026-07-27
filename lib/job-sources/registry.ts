// Module 3 — maps active job_sources rows to their adapter implementation
import type { SupabaseClient } from "@supabase/supabase-js";
import { JsearchAdapter } from "./jsearch-adapter";
import type { JobSourceAdapter } from "./types";

// Adding a second source means one new adapter file plus one more branch
// here (and a job_sources row) — nothing else in the module changes.
export async function getJobSourceAdapters(supabase: SupabaseClient): Promise<JobSourceAdapter[]> {
  const { data: sources } = await supabase
    .from("job_sources")
    .select("slug, config")
    .eq("is_active", true);

  const adapters: JobSourceAdapter[] = [];

  for (const source of sources ?? []) {
    if (source.slug === "jsearch") {
      adapters.push(new JsearchAdapter(source.config ?? {}));
    }
  }

  return adapters;
}
