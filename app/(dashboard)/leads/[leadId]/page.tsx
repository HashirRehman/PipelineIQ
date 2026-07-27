import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { WithdrawLeadForm } from "@/components/withdraw-lead-form";
import { ReapplyLeadForm } from "@/components/reapply-lead-form";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const supabase = await createClient();

  // leads_select RLS (is_admin() OR bd_user_id = auth.uid()) means a null
  // result here covers both "doesn't exist" and "exists but isn't visible
  // to you" — same deliberate non-distinction as the engineer detail page.
  const { data: lead } = await supabase
    .from("leads")
    .select("id, status, applied_at, job_id, engineer_id, engineers(full_name), jobs(title, company_name, apply_url)")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Lead not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Reapply is only offered when it would actually succeed. A withdrawn
  // lead's pairing may already have been superseded by a newer
  // active/closed lead (e.g. reapplied once already, from this same
  // page) — create_lead_from_match()'s own duplicate check would reject
  // that with a clean message regardless, but showing the button anyway
  // would just be inviting a click that's guaranteed to fail.
  //
  // This check is RLS-scoped like everything else on this page, so for a
  // non-Admin BD it only sees leads *they* own — if some other BD holds
  // the superseding lead (a real possibility now that engineers can be
  // reassigned, see the owned-lead visibility carve-out), this won't see
  // it and the button could still show. That narrower case still fails
  // safely via the RPC's own check; this is a best-effort UI hide, not a
  // second authorization boundary.
  let canReapply = false;
  if (lead.status === "withdrawn") {
    const { data: supersedingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("job_id", lead.job_id)
      .eq("engineer_id", lead.engineer_id)
      .neq("status", "withdrawn")
      .limit(1)
      .maybeSingle();
    canReapply = !supersedingLead;
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{lead.jobs?.title ?? "—"}</h1>
          <p className="text-sm text-muted-foreground">{lead.jobs?.company_name}</p>
        </div>
        <LeadStatusBadge status={lead.status} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Engineer</div>
            <div className="font-medium">{lead.engineers?.full_name ?? "—"}</div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Applied</div>
            <div className="font-medium">{new Date(lead.applied_at).toLocaleDateString()}</div>
          </div>

          {lead.jobs?.apply_url && (
            <a
              href={lead.jobs.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              Apply Now →
            </a>
          )}

          {/* No separate owner/admin check here — leads_select already
              guarantees that if this row was returned at all, the viewer
              is the owner or Admin, the same predicate withdraw_lead()
              itself checks. The only real gate left is status. */}
          {lead.status === "active" && (
            <div className="border-t border-border pt-4">
              <WithdrawLeadForm leadId={lead.id} />
            </div>
          )}

          {canReapply && (
            <div className="border-t border-border pt-4">
              <ReapplyLeadForm leadId={lead.id} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
