import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, type StatusBadgeVariant } from "@/components/status-badge";

const LEAD_STATUS_VARIANT: Record<string, StatusBadgeVariant> = {
  active: "info",
  withdrawn: "neutral",
  closed: "success",
};

const LEAD_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  withdrawn: "Withdrawn",
  closed: "Closed",
};

export default async function LeadsPage() {
  const supabase = await createClient();

  const { data: isAdmin } = await supabase.rpc("is_admin");

  // Same query for both roles — the difference in results comes entirely
  // from the leads_select RLS policy (is_admin() OR bd_user_id =
  // auth.uid()), matching the convention set by /engineers and /discovery.
  const { data: leads } = await supabase
    .from("leads")
    .select("id, status, applied_at, engineers(full_name), jobs(title, company_name)")
    .order("applied_at", { ascending: false });

  const list = leads ?? [];

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "All leads across the BD team." : "Leads you own."}
        </p>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {isAdmin ? "No leads yet." : "You don't have any leads yet."}
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
                    <StatusBadge variant={LEAD_STATUS_VARIANT[lead.status] ?? "neutral"}>
                      {LEAD_STATUS_LABEL[lead.status] ?? lead.status}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3">{lead.engineers?.full_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{lead.jobs?.title ?? "—"}</div>
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
