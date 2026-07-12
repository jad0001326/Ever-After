"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ open, title, description, onClose, children }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel) return;
      const elements = [...panel.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")];
      if (!elements.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; returnFocusRef.current?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#152017]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="budget-modal-title" aria-describedby={description ? "budget-modal-description" : undefined} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-[var(--background)] shadow-2xl sm:max-w-2xl sm:rounded-[1.75rem]">
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--line)] bg-[var(--background)]/95 px-5 py-4 backdrop-blur sm:px-7"><div><h2 id="budget-modal-title" className="font-display text-3xl font-semibold">{title}</h2>{description ? <p id="budget-modal-description" className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}</div><button className="focus-ring grid size-11 shrink-0 place-items-center rounded-full text-[#4f4a43] transition hover:bg-white" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}

