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

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge variant={LEAD_STATUS_VARIANT[status] ?? "neutral"}>
      {LEAD_STATUS_LABEL[status] ?? status}
    </StatusBadge>
  );
}
