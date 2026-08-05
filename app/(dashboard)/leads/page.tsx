import Link from "next/link";
import { createClient, getCachedIsAdmin } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { LeadsFilterForm } from "@/components/leads-filter-form";
import { leadsFilterSchema } from "@/lib/validation/schemas";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ engineerId?: string; status?: string; from?: string; to?: string }>;
}) {
  const supabase = await createClient();

  const rawParams = await searchParams;
  const filters = leadsFilterSchema.parse(rawParams);
  const hasAnyFilter = Boolean(filters.engineerId || filters.status || filters.from || filters.to);

  // Options for the engineer dropdown come from this same RLS-scoped
  // table, unfiltered — a BD only ever sees engineers they actually have
  // leads for, Admin sees everyone. Deliberately separate from the main
  // (filtered) query below so picking one filter never shrinks another
  // filter's own option list. isAdmin and this query are independent of
  // each other — fetched concurrently rather than one after the other.
  const [isAdmin, { data: engineerRows }] = await Promise.all([
    getCachedIsAdmin(),
    supabase.from("leads").select("engineer_id, engineers(full_name)"),
  ]);
  const engineerOptions = Array.from(
    new Map(
      (engineerRows ?? []).map((row) => [row.engineer_id, row.engineers?.full_name ?? "—"]),
    ).entries(),
  )
    .map(([id, fullName]) => ({ id, fullName }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  // Same query for both roles — the difference in results comes entirely
  // from the leads_select RLS policy (is_admin() OR bd_user_id =
  // auth.uid()), matching the convention set by /engineers and the root
  // discovery tab.
  // Filters are additional .eq()/.gte()/.lte() calls chained onto this
  // same query — Postgres evaluates RLS as part of the query plan
  // regardless, so they can only ever narrow this role-scoped result,
  // never widen it (same guarantee already proven for the root
  // discovery tab's pagination).
  let query = supabase
    .from("leads")
    .select("id, status, applied_at, engineers(full_name), jobs(title, company_name)")
    .order("applied_at", { ascending: false });

  if (filters.engineerId) query = query.eq("engineer_id", filters.engineerId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("applied_at", filters.from);
  if (filters.to) query = query.lte("applied_at", `${filters.to}T23:59:59.999`);

  const { data: leads } = await query;

  const list = leads ?? [];

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "All leads across the BD team." : "Leads you own."}
        </p>
      </div>

      <LeadsFilterForm engineerOptions={engineerOptions} currentFilters={filters} />

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {hasAnyFilter
              ? "No leads match these filters."
              : isAdmin
                ? "No leads yet."
                : "You don't have any leads yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Engineer</th>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3">{lead.engineers?.full_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.jobs?.title ?? "—"}
                    </Link>
                    {lead.jobs?.company_name && (
                      <div className="text-muted-foreground">{lead.jobs.company_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(lead.applied_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
