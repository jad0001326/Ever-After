"use client";

import { Link as LinkIcon, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trackBudgetEvent } from "@/lib/budget/analytics";

type StarterShareActionsProps = {
  budget: string;
  description: string;
  path: string;
  title: string;
};

export function StarterShareActions({ budget, description, path, title }: StarterShareActionsProps) {
  const [status, setStatus] = useState("");
  const [manualCopyUrl, setManualCopyUrl] = useState("");

  function getShareUrl() {
    return new URL(path, window.location.origin).toString();
  }

  function copyUsingSelection(value: string) {
    if (typeof document.execCommand !== "function") return false;
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand("copy");
    textArea.remove();
    return copied;
  }

  async function copyLink() {
    const shareUrl = getShareUrl();
    setManualCopyUrl("");
    setStatus("Copying link…");
    try {
      if (!copyUsingSelection(shareUrl)) {
        await Promise.race([
          navigator.clipboard.writeText(shareUrl),
          new Promise((_, reject) => window.setTimeout(() => reject(new Error("Clipboard timed out")), 1_200))
        ]);
      }
      setStatus("Link copied — ready to share.");
      trackBudgetEvent("starter_budget_shared", { budget, method: "copy_link" });
    } catch {
      setManualCopyUrl(shareUrl);
      setStatus("Clipboard access was blocked. Select the link below to copy it.");
    }
  }

  async function shareBudget() {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({ title, text: description, url: getShareUrl() });
      setStatus("Budget shared.");
      trackBudgetEvent("starter_budget_shared", { budget, method: "native_share" });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Sharing was not available. Try copying the link instead.");
    }
  }

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="px-4" onClick={shareBudget}>
          <Share2 size={16} /> Share this budget
        </Button>
        <Button type="button" variant="ghost" className="px-4" onClick={copyLink}>
          <LinkIcon size={16} /> Copy link
        </Button>
      </div>
      <p className="mt-2 min-h-5 text-xs font-medium text-[#66725f] sm:text-right" aria-live="polite">
        {status}
      </p>
      {manualCopyUrl ? (
        <label className="mt-2 grid gap-1 text-xs font-medium text-[#66725f]">
          Budget link
          <input
            aria-label="Budget link to copy"
            className="focus-ring w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={manualCopyUrl}
          />
        </label>
      ) : null}
    </div>
  );
}
