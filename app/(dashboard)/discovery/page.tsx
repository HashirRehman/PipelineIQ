import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DismissMatchForm } from "@/components/dismiss-match-form";

function remoteBadgeLabel(isRemote: boolean | null, remoteRegion: string | null): string {
  if (!isRemote) return "On-site";
  return remoteRegion ? `Remote — ${remoteRegion}` : "Remote";
}

export default async function DiscoveryPage() {
  const supabase = await createClient();

  const { data: isAdmin } = await supabase.rpc("is_admin");

  // Same query for both roles — the difference in results comes entirely
  // from the transitive jobs_select/job_engineer_matches_select RLS
  // policies (is_admin() OR engineer_id IN assigned_engineer_ids()), not
  // from any role branching here. Matches this codebase's convention set
  // by /engineers.
  const { data: matches } = await supabase
    .from("job_engineer_matches")
    .select(
      "id, relevance_score, engineers(full_name), jobs(title, company_name, location, apply_url, is_remote, remote_region, posted_at)",
    )
    .eq("status", "suggested")
    .order("relevance_score", { ascending: false });

  const list = matches ?? [];

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Discovery</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "AI-suggested job matches across all engineers."
            : "AI-suggested job matches for engineers assigned to you."}
        </p>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No suggested matches right now. Check back after tonight&apos;s discovery run.
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
    </div>
  );
}
