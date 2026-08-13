"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

export function PlanningHubItemRemoval({
  disabled = false,
  itemKind,
  itemName,
  onRemove,
}: {
  disabled?: boolean;
  itemKind: string;
  itemName: string;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const descriptionId = useId();
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const keepButtonRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreTriggerFocus = useRef(false);

  useEffect(() => {
    if (confirming) {
      keepButtonRef.current?.focus();
      return;
    }
    if (shouldRestoreTriggerFocus.current) {
      triggerRef.current?.focus();
      shouldRestoreTriggerFocus.current = false;
    }
  }, [confirming]);

  if (!confirming) {
    return (
      <div className="border-b border-[#e4ddd2] p-5">
        <button
          className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#b85b4b] px-4 text-sm font-semibold text-[#8f352b] disabled:opacity-60"
          disabled={disabled}
          onClick={() => {
            shouldRestoreTriggerFocus.current = true;
            setConfirming(true);
          }}
          ref={triggerRef}
          type="button"
        >
          <Trash2 size={17} /> Remove from plan
        </button>
      </div>
    );
  }

  return (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="border-b border-[#e4ddd2] bg-[#fff5f2] p-5"
      role="group"
    >
      <p className="font-semibold text-[#772f28]" id={titleId}>Remove {itemName} from your plan?</p>
      <p className="mt-2 text-xs leading-5 text-[#625f57]" id={descriptionId}>
        Its cost, payments and availability will stop contributing to this plan. You can add this {itemKind} again later.
      </p>
      <div className="mt-4 grid gap-2">
        <button
          className="focus-ring min-h-11 rounded-xl bg-[#8f352b] px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={disabled}
          onClick={onRemove}
          type="button"
        >
          Yes, remove from plan
        </button>
        <button
          className="focus-ring min-h-11 rounded-xl border border-[#cfc3b3] bg-white px-4 text-sm font-semibold text-[#403b35]"
          onClick={() => setConfirming(false)}
          ref={keepButtonRef}
          type="button"
        >
          Keep in plan
        </button>
      </div>
    </div>
  );
}
