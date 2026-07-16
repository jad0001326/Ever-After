import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--background)]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo href="/" variant="wordmark" showArch={false} wordmarkClassName="text-[2.2rem] sm:text-[2.45rem]" />
        <nav aria-label="Primary navigation" className="flex items-center gap-1">
          <Link className="focus-ring hidden h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] sm:inline-flex sm:px-3" href="/venues">Venues</Link>
          <Link className="focus-ring hidden h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] md:inline-flex md:px-3" href="/photographers">Photographers</Link>
          <Link className="focus-ring inline-flex h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] sm:px-3" href="/wedding-budget-planner">Budget</Link>
          <Link className="focus-ring inline-flex h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] sm:px-3" href="/wedding-table-planner">Tables</Link>
          <Link className="focus-ring hidden h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] sm:inline-flex sm:px-3" href="/guides">Guides</Link>
          <Link className="focus-ring hidden h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] md:inline-flex md:px-3" href="/for-business">For businesses</Link>
          <Link className="focus-ring inline-flex h-10 items-center rounded-full px-2 text-sm font-medium text-[#4f4a43] transition hover:bg-white hover:text-[#191713] sm:px-3" href="/login">Sign in</Link>
          <Link className="focus-ring hidden min-h-10 items-center rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white transition hover:bg-[#183522] lg:inline-flex" href="/for-business">List your business</Link>
        </nav>
      </div>
    </header>
  );
}
