import { Beer, CupSoda, Wine, Droplets } from "lucide-react";

const ICONS = { Draft: Beer, Can: CupSoda, Bottle: Wine, Nitro: Droplets } as const;

/** Small pill for how a beer was served. */
export function MethodBadge({ method }: { method: string }) {
  const Icon = ICONS[method as keyof typeof ICONS] ?? Beer;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
      <Icon size={11} aria-hidden="true" />
      {method}
    </span>
  );
}
