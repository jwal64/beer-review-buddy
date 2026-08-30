import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 px-5 pb-4 pt-6 backdrop-blur">
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 py-5">{children}</main>
      <BottomNav />
    </div>
  );
}
