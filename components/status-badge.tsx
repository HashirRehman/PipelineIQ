import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

const STATUS_TO_BADGE_VARIANT = {
  success: "success",
  warning: "warning",
  danger: "destructive",
  info: "info",
  neutral: "outline",
} as const;

export type StatusBadgeVariant = keyof typeof STATUS_TO_BADGE_VARIANT;

// Generic, semantic status pill — not tied to any specific domain status
// (lead state, match state, pipeline stage, etc.). Future modules decide
// which semantic variant a given domain status maps to at the call site,
// e.g. <StatusBadge variant="success">Active</StatusBadge>.
export function StatusBadge({
  variant,
  children,
}: {
  variant: StatusBadgeVariant;
  children: ReactNode;
}) {
  return <Badge variant={STATUS_TO_BADGE_VARIANT[variant]}>{children}</Badge>;
}
