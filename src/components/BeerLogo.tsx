import { useState } from "react";
import { beerLogo } from "@/lib/logos";
import { useBrandDomains } from "@/lib/beer-data";
import { cn } from "@/lib/utils";

export function BeerLogo({ name, className }: { name: string; className?: string }) {
  // Shared with every other card on the page — react-query fetches it once.
  const { data: domains } = useBrandDomains();
  const src = beerLogo(name, domains);
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary",
        className,
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={`${name} logo`}
          loading="lazy"
          className="h-3/5 w-3/5 object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-display text-lg text-primary">{name.charAt(0)}</span>
      )}
    </div>
  );
}
