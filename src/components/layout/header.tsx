import Link from "next/link";
import { Heart, LayoutDashboard, Search, UserRound } from "lucide-react";

const nav = [
  { href: "/venues", label: "Venues", icon: Search },
  { href: "/admin", label: "Admin", icon: LayoutDashboard },
  { href: "/login", label: "Sign in", icon: UserRound }
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[#fbfaf7]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="Ever After home">
          <span className="grid size-9 place-items-center rounded-full bg-[var(--brand)] text-[var(--brand-ink)]">
            <Heart size={16} strokeWidth={1.8} />
          </span>
          <span className="font-display text-2xl font-semibold tracking-normal">Ever After</span>
        </Link>
        <nav className="flex items-center gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className="focus-ring inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] sm:px-4"
                href={item.href}
                key={item.href}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
