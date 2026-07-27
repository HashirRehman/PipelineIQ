// Module 3 — JobSourceAdapter interface

export interface RawJobListing {
  externalId: string;
  title: string;
  companyName: string;
  location?: string;
  description?: string;
  applyUrl: string;
  postedAt?: Date;
  // Additive beyond doc 03's literal interface — carries the source's own
  // remote flag through so it can populate jobs.is_remote (doc 02 line 288:
  // "populated from the source's own remote flag"). jobs.remote_region is
  // deliberately not sourced here — doc 02 says it's AI-filled from the
  // description, and no AiClient method for that exists yet; left null
  // until that's built as a Phase 2 enhancement.
  isRemote?: boolean;
}

export interface JobSourceAdapter {
  sourceSlug: string;
  fetchListings(params: { since?: Date }): Promise<RawJobListing[]>;
}
