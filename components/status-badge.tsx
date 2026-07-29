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

export function StatusBadge({
  variant,
  children,
}: {
  variant: StatusBadgeVariant;
  children: ReactNode;
}) {
  return <Badge variant={STATUS_TO_BADGE_VARIANT[variant]}>{children}</Badge>;
}
