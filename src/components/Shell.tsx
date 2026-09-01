import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { useSession } from "@/lib/use-session";
import { supabase } from "@/integrations/supabase/client";

function SessionButton() {
  const { isSignedIn, ready } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!ready) return <div className="h-9 w-9" />;

  if (!isSignedIn) {
    return (
      <Link
        to="/auth"
        aria-label="Sign in"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogIn size={16} />
      </Link>
    );
  }

  return (
    <button
      aria-label="Sign out"
      onClick={async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
        navigate({ to: "/", replace: true });
      }}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
    >
      <LogOut size={16} />
    </button>
  );
}

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
        <div className="mx-auto flex max-w-md items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <SessionButton />
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 py-5">{children}</main>
      <BottomNav />
    </div>
  );
}
