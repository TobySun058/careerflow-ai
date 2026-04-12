import type { ReactNode } from "react";

export function NotebookShell({
  left,
  center,
  right
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)_330px]">
      <aside className="min-h-0 overflow-hidden">{left}</aside>
      <main className="min-h-0 overflow-hidden">{center}</main>
      <aside className="min-h-0 overflow-hidden">{right}</aside>
    </div>
  );
}
