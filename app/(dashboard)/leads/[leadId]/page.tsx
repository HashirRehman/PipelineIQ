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
