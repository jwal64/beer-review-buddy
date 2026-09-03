import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** What a failed fetch renders. Before this, a screen whose query errored drew
 * nothing at all, which reads exactly like an empty log. */
export function QueryError({ onRetry, what = "data" }: { onRetry?: () => void; what?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <AlertTriangle className="mx-auto text-muted-foreground" size={22} />
      <p className="mt-2 text-sm font-medium">Couldn't load the {what}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Check your connection — the log is still here.
      </p>
      {onRetry && (
        <Button variant="secondary" className="mt-4 h-9 rounded-xl" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
