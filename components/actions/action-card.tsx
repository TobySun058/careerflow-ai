import type { ReactNode } from "react";

import { CircleHelp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ActionCard({
  title,
  description,
  onClick,
  icon,
  disabled
}: {
  title: string;
  description: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Card className="glass-panel border-white/80 p-4">
      <div className="flex items-start gap-3">
        {icon ? <div className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{title}</p>
            <button
              aria-label={`${title} help`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-white/75 text-muted-foreground transition hover:text-foreground"
              title={description}
              type="button"
            >
              <CircleHelp className="h-4 w-4" />
            </button>
          </div>
          <Button className="mt-3 w-full" disabled={disabled} onClick={onClick} variant="outline">
            Run
          </Button>
        </div>
      </div>
    </Card>
  );
}
