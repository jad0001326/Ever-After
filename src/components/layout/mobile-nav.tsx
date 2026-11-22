"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const links = [
  ["/venues", "Venues"],
  ["/photographers", "Photographers"],
  ["/suppliers/videographer", "Videographers"],
  ["/guides", "Guides"],
  ["/for-business", "For businesses"]
] as const;

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        aria-controls="mobile-directory"
        aria-expanded={open}
        className="focus-ring inline-flex size-10 items-center justify-center rounded-full text-[#4f4a43] transition hover:bg-white"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>
      {open ? (
        <nav aria-label="Directory" className="absolute inset-x-0 top-full border-b border-[var(--line)] bg-[var(--background)] px-4 py-3 shadow-lg" id="mobile-directory">
          <div className="grid gap-1">
            {links.map(([href, label]) => (
              <Link className="focus-ring rounded-2xl px-3 py-3 text-sm font-medium text-[#4f4a43] hover:bg-white" href={href} key={href} onClick={() => setOpen(false)} prefetch={false}>
                {label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
