import type { ReactNode } from "react";

export function ThreePanelShell({
  left,
  center,
  right
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="grid min-h-[calc(100vh-2rem)] grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      <aside className="min-h-0">{left}</aside>
      <main className="min-h-0">{center}</main>
      <aside className="min-h-0">{right}</aside>
    </div>
  );
}
