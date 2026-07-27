// Module 3 — JSearch (RapidAPI) adapter
//
// Endpoint confirmed via a live call during sub-chunk 2: the working path
// is /search-v2 (not /search, which 404s for this RapidAPI application),
// and the real remote-only filter param is work_from_home (confirmed by
// checking every returned job's job_is_remote flag was true when this
// param was set — not just trusting the docs' example phrasing blindly).
import type { JobSourceAdapter, RawJobListing } from "./types";

const JSEARCH_BASE_URL = "https://jsearch.p.rapidapi.com";

type JsearchJob = {
  job_id: string;
  job_title: string;
  employer_name: string;
  job_apply_link: string;
  job_description: string | null;
  job_is_remote: boolean | null;
  job_posted_at_datetime_utc: string | null;
  job_location: string | null;
};

type JsearchConfig = {
  query?: string;
  work_from_home?: boolean;
  // Comma-separated ISO country codes. JSearch has no "worldwide" sentinel —
  // omitting this param (or passing it empty) silently defaults to "us"
  // (confirmed live), so broadening past the US requires an explicit list.
  country?: string;
};

// JSearch's date_posted only supports coarse buckets, not an arbitrary
// since-timestamp — any overlap this causes across runs is harmless given
// the (job_source_id, external_job_id) upsert's idempotency.
function datePostedBucket(since?: Date): "today" | "3days" | "week" | "month" {
  if (!since) {
    return "3days";
  }
  const hoursSince = (Date.now() - since.getTime()) / (1000 * 60 * 60);
  if (hoursSince <= 36) {
    return "today";
  }
  if (hoursSince <= 24 * 7) {
    return "week";
  }
  return "month";
}

export class JsearchAdapter implements JobSourceAdapter {
  sourceSlug = "jsearch";

  constructor(private readonly config: JsearchConfig) {}

  async fetchListings({ since }: { since?: Date }): Promise<RawJobListing[]> {
    const apiKey = process.env.JSEARCH_API_KEY;
    if (!apiKey) {
      throw new Error("JSEARCH_API_KEY is not set.");
    }

    const params = new URLSearchParams({
      query: this.config.query ?? "software engineer",
      work_from_home: String(this.config.work_from_home ?? true),
      date_posted: datePostedBucket(since),
      page: "1",
      // One page per run for MVP — keeps free-tier quota usage bounded.
      num_pages: "1",
      country: this.config.country ?? "us,gb,ca,au,ie,de,nl,in",
    });

    const response = await fetch(`${JSEARCH_BASE_URL}/search-v2?${params.toString()}`, {
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": "jsearch.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      throw new Error(`JSearch request failed: ${response.status} ${await response.text()}`);
    }

    const body: { data?: { jobs?: JsearchJob[] } } = await response.json();
    const jobs = body.data?.jobs ?? [];

    return jobs.map((job) => ({
      externalId: job.job_id,
      title: job.job_title,
      companyName: job.employer_name,
      location: job.job_location ?? undefined,
      description: job.job_description ?? undefined,
      applyUrl: job.job_apply_link,
      postedAt: job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : undefined,
      isRemote: job.job_is_remote ?? undefined,
    }));
  }
}
