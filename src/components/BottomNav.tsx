import { Link } from "@tanstack/react-router";
import { Home, Beer, Map, BarChart3 } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/beers", label: "Beers", icon: Beer },
  { to: "/map", label: "Map", icon: Map },
  { to: "/insights", label: "Insights", icon: BarChart3 },
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
              activeProps={{ className: "text-primary [&>span]:bg-primary/15" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="rounded-full px-4 py-1 transition-colors">
                <Icon size={20} aria-hidden="true" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
