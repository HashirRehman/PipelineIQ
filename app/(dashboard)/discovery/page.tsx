import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DismissMatchForm } from "@/components/dismiss-match-form";
import { RunDiscoveryButton } from "@/components/run-discovery-button";

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

  const { data: isAdmin } = await supabase.rpc("is_admin");

  const { page: pageParam } = await searchParams;
  const parsedPage = Number(pageParam ?? "1");
  const currentPage = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Same query for both roles — the difference in results comes entirely
  // from the transitive jobs_select/job_engineer_matches_select RLS
  // policies (is_admin() OR engineer_id IN assigned_engineer_ids()), not
  // from any role branching here. Matches this codebase's convention set
  // by /engineers. { count: "exact" } and .range() apply to this exact
  // same RLS-filtered query — Postgres evaluates row security as part of
  // the query plan before ORDER BY/LIMIT/OFFSET, so pagination can only
  // ever slice the already-role-scoped result set, never bypass it.
  const { data: matches, count } = await supabase
    .from("job_engineer_matches")
    .select(
      "id, relevance_score, engineers(full_name), jobs(title, company_name, location, apply_url, is_remote, remote_region, posted_at)",
      { count: "exact" },
    )
    .eq("status", "suggested")
    .order("relevance_score", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

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
                  <DismissMatchForm matchId={match.id} />
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
