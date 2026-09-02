import { useState } from "react";
import { beerLogoSources, isSuspectFavicon } from "@/lib/logos";
import { useBrandDomains } from "@/lib/beer-data";
import { cn } from "@/lib/utils";

// Walks the tiered source chain (local override → Brandfetch → Google
// favicons → Icon Horse) one <img> at a time, the same order the stats site
// uses. A source that errors advances the chain; so does a Google favicon
// that "loads" at 16px, which is the service's generic globe standing in for
// a domain it doesn't know. The styled monogram renders only when every
// source has been tried.
export function BeerLogo({
  name,
  logo,
  style,
  className,
}: {
  name: string;
  /** The beer row's `logo` column — a local `logos/<file>` override or a recorded hotlink. */
  logo?: string | null | undefined;
  /** The beer's style, used to tint the monogram when no logo resolves. */
  style?: string | null | undefined;
  className?: string | undefined;
}) {

  // Shared with every other card on the page — react-query fetches it once.
  const { data: domains } = useBrandDomains();
  const sources = beerLogoSources(name, domains, logo);
  const [tier, setTier] = useState(0);
  // A list row's component can be reused for a different beer — restart the
  // chain when the name changes rather than carrying the old beer's progress.
  const [seenName, setSeenName] = useState(name);
  if (seenName !== name) {
    setSeenName(name);
    setTier(0);
  }

  const src = sources[tier];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary",
        className,
      )}
    >
      {src ? (
        <img
          key={src}
          src={src}
          alt={`${name} logo`}
          loading="lazy"
          className="h-3/5 w-3/5 object-contain"
          onError={() => setTier((t) => t + 1)}
          onLoad={(e) => {
            if (isSuspectFavicon(src, e.currentTarget.naturalWidth)) setTier((t) => t + 1);
          }}
        />
      ) : (
        <span className="font-display text-lg text-primary">{name.charAt(0)}</span>
      )}
    </div>
  );
}
