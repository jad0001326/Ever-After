"use client";

import { useMemo, useState } from "react";
import { Clipboard, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type OutreachEmailCardProps = {
  claimUrl: string;
  galleryUrl?: string | null;
  name: string;
  town: string;
};

export function OutreachEmailCard({ claimUrl, galleryUrl, name, town }: OutreachEmailCardProps) {
  const [copied, setCopied] = useState(false);
  const email = useMemo(() => buildInviteEmail({ claimUrl, galleryUrl, name, town }), [claimUrl, galleryUrl, name, town]);

  async function copyEmail() {
    await navigator.clipboard.writeText(email);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[#fbf8f3] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-[#4a443c]">Founding partner invite</p>
        <Button onClick={copyEmail} type="button" variant="secondary">
          {copied ? <Check size={16} /> : <Clipboard size={16} />}
          {copied ? "Copied" : "Copy email"}
        </Button>
      </div>
      <pre className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-xs leading-5 text-[#4a443c] ring-1 ring-[var(--line)]">
        {email}
      </pre>
    </div>
  );
}

function buildInviteEmail({ claimUrl, galleryUrl, name, town }: OutreachEmailCardProps) {
  return `Subject: Your wedding venue listing on EverAft

Hi ${name} team,

We have added ${name} in ${town} to EverAft, a curated Scottish wedding venue discovery platform built for couples comparing venues by style, location, capacity, imagery, and enquiry path.

Your listing is live with representative launch content while we verify venue-approved details. You can claim the listing to review the information, add approved photography, update enquiry details, and keep the page accurate.

Claim your listing here:
${claimUrl}

${galleryUrl ? `We also found your public gallery here:\n${galleryUrl}\n\n` : ""}During launch, we are offering founding venue partners a lifetime discount for early participation.

Best,
EverAft`;
}
