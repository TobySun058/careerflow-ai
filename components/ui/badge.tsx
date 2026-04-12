import * as React from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "outline" | "success";
}) {
  const styles = {
    default: "bg-primary/12 text-primary",
    secondary: "bg-secondary text-secondary-foreground",
    outline: "border border-border/70 text-foreground",
    success: "bg-success/15 text-success"
  }[variant];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        styles,
        className
      )}
      {...props}
    />
  );
}
