// Module 3 — JobSourceAdapter interface

export interface RawJobListing {
  externalId: string;
  title: string;
  companyName: string;
  location?: string;
  description?: string;
  applyUrl: string;
  postedAt?: Date;
  isRemote?: boolean;
}

export interface JobSourceAdapter {
  sourceSlug: string;
  sourceName: string;
  sourceId: string;
  fetchListings(params: { since?: Date }): Promise<RawJobListing[]>;
}
