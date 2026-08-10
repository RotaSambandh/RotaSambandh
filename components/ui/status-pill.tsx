import { Badge } from "@/components/ui/badge";
import type { StatusTone } from "@/lib/ui/status-labels";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const toneToVariant: Record<StatusTone, "default" | "success" | "warning" | "neutral" | "danger"> = {
  default: "default",
  success: "success",
  warning: "warning",
  neutral: "neutral",
  danger: "danger",
};

/** Human status chip — prefer this over raw status.replaceAll dumps. */
export function StatusPill({
  label,
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  label: string;
  tone?: StatusTone;
}) {
  return (
    <Badge
      variant={toneToVariant[tone]}
      className={cn("capitalize", className)}
      {...props}
    >
      {label}
    </Badge>
  );
}
