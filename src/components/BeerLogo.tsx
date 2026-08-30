import { useState } from "react";
import { beerLogo } from "@/lib/logos";
import { cn } from "@/lib/utils";

export function BeerLogo({
  name,
  brewery,
  className,
}: {
  name: string;
  brewery?: string | null;
  className?: string;
}) {
  const src = beerLogo(name, brewery);
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
