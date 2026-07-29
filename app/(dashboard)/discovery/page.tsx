import Link from "next/link";
import { createClient, getCachedIsAdmin } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DismissMatchForm } from "@/components/dismiss-match-form";
import { MarkAppliedForm } from "@/components/mark-applied-form";
import { RunDiscoveryButton } from "@/components/run-discovery-button";
import { HiringStatusBadge } from "@/components/hiring-status-badge";

const PAGE_SIZE = 10;

function remoteBadgeLabel(isRemote: boolean | null, remoteRegion: string | null): string {
  if (!isRemote) return "On-site";
  return remoteRegion ? `Remote — ${remoteRegion}` : "Remote";
}

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();

  const { page: pageParam } = await searchParams;
  const parsedPage = Number(pageParam ?? "1");
  const currentPage = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Admin-tunable BD score floor — fail closed to the hardcoded default if
  // app_settings is missing/malformed, same pattern as the CV upload limits.
  // isAdmin and this setting are independent of each other — fetched
  // concurrently rather than one after the other.
  const DEFAULT_MIN_RELEVANCE_SCORE = 60;
  const [isAdmin, { data: minScoreSetting }] = await Promise.all([
    getCachedIsAdmin(),
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "discovery_min_relevance_score")
      .maybeSingle(),
  ]);
  const minRelevanceScore =
    typeof minScoreSetting?.value === "number" ? minScoreSetting.value : DEFAULT_MIN_RELEVANCE_SCORE;

  // RLS still does all row-level role scoping via the transitive
  // jobs_select/job_engineer_matches_select policies, same as everywhere
  // else. The two filters below are a deliberate, acknowledged departure
  // from this codebase's usual "never branch the query by role" convention:
  // is_globally_open applies to everyone (a country-restricted job is
  // unusable regardless of who's looking), while the relevance-score floor
  // is BD-only — Admin's view stays unfiltered on score for oversight/QA.
  // Neither filter touches what runJobDiscovery scores or writes; every
  // pairing still gets a job_engineer_matches row regardless of score.
  // jobs!inner (not a plain embed) is required for .eq("jobs...") below to
  // filter the join itself rather than just shaping the embedded object.
  let query = supabase
    .from("job_engineer_matches")
    .select(
      "id, relevance_score, engineers(full_name), jobs!inner(title, company_name, location, apply_url, is_remote, remote_region, posted_at, is_globally_open, possibly_closed)",
      { count: "exact" },
    )
    .eq("status", "suggested")
    .eq("jobs.is_globally_open", true)
    .order("relevance_score", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (!isAdmin) {
    query = query.gte("relevance_score", minRelevanceScore);
  }

  const { data: matches, count } = await query;

  const list = matches ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Discovery</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "AI-suggested job matches across all engineers."
              : "AI-suggested job matches for engineers assigned to you."}
          </p>
        </div>
        <RunDiscoveryButton />
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {currentPage > 1
              ? "No matches on this page."
              : "No suggested matches right now. Check back after tonight's discovery run."}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((match) => (
            <Card key={match.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{match.jobs?.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {match.jobs?.company_name}
                      {match.jobs?.location ? ` · ${match.jobs.location}` : ""}
                    </p>
                  </div>
                  <Badge variant="info">{Number(match.relevance_score).toFixed(0)}% match</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{match.engineers?.full_name}</Badge>
                  <Badge variant="outline">
                    {remoteBadgeLabel(match.jobs?.is_remote ?? null, match.jobs?.remote_region ?? null)}
                  </Badge>
                  {match.jobs?.possibly_closed && <HiringStatusBadge />}
                  {match.jobs?.posted_at && (
                    <span className="text-xs text-muted-foreground">
                      Posted {new Date(match.jobs.posted_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <a
                    href={match.jobs?.apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Apply Now →
                  </a>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <MarkAppliedForm matchId={match.id} />
                    <DismissMatchForm matchId={match.id} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalCount > 0 && (
        <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {currentPage} of {totalPages} ({totalCount} total match{totalCount === 1 ? "" : "es"})
          </span>
          <div className="flex gap-2">
            {currentPage > 1 ? (
              <Button variant="outline" size="sm" render={<Link href={`/discovery?page=${currentPage - 1}`} />}>
                Previous
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            )}
            {currentPage < totalPages ? (
              <Button variant="outline" size="sm" render={<Link href={`/discovery?page=${currentPage + 1}`} />}>
                Next
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
