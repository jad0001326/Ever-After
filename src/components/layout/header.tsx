import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { planningHubPublicEntryEnabled } from "@/lib/planning-hub/public-entry";

export function Header() {
  const planningHubEnabled = planningHubPublicEntryEnabled();
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--background)] sm:bg-[var(--background)]/90 sm:backdrop-blur-xl">
      <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo href="/" variant="wordmark" showArch={false} wordmarkClassName="text-[2.2rem] sm:text-[2.45rem]" />
        <nav aria-label="Primary navigation" className="flex items-center gap-1">
          <Link className="focus-ring hidden h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] sm:inline-flex sm:px-3" href="/venues" prefetch={false}>Venues</Link>
          <Link className="focus-ring hidden h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] md:inline-flex md:px-3" href="/photographers" prefetch={false}>Photographers</Link>
          {planningHubEnabled ? <Link className="focus-ring inline-flex h-10 items-center rounded-full px-2 text-sm font-semibold text-[#24432f] transition hover:bg-white hover:text-[#191713] sm:px-3" href="/planning-hub" prefetch={false}>Plan</Link> : null}
          <Link className={`focus-ring h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] sm:px-3 ${planningHubEnabled ? "hidden sm:inline-flex" : "inline-flex"}`} href="/wedding-budget-planner" prefetch={false}>Budget</Link>
          <Link className={`focus-ring h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] sm:px-3 ${planningHubEnabled ? "hidden md:inline-flex" : "inline-flex"}`} href="/wedding-table-planner" prefetch={false}>Tables</Link>
          <Link className="focus-ring hidden h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] sm:inline-flex sm:px-3" href="/guides" prefetch={false}>Guides</Link>
          <Link className="focus-ring hidden h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] md:inline-flex md:px-3" href="/for-business" prefetch={false}>For businesses</Link>
          <Link className="focus-ring inline-flex h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] sm:px-3" href="/login" prefetch={false}>Sign in</Link>
          <Link className="focus-ring hidden min-h-10 items-center rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white transition hover:bg-[#183522] lg:inline-flex" href="/for-business" prefetch={false}>List your business</Link>
        </nav>
      </div>
    </header>
  );
}
