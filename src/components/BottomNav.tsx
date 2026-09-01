import { Link } from "@tanstack/react-router";
import { Home, Beer, Map, BarChart3 } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/beers", label: "Beers", icon: Beer },
  { to: "/map", label: "Map", icon: Map },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-stretch">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              activeProps={{ className: "text-primary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors"
            >
              <Icon size={20} />
              {label}
            </Link>
          </li>
        ))}
        <li className="flex-1">
          {/* The full analytics site — a static page, so a document link
              rather than a router Link. */}
          <a
            href="/stats/index.html"
            className="flex flex-col items-center gap-1 py-3 text-[11px] font-medium text-muted-foreground transition-colors"
          >
            <BarChart3 size={20} />
            Stats
          </a>
        </li>
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
