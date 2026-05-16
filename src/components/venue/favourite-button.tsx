"use client";

import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavourite } from "@/app/actions/favourites";
import { Button } from "@/components/ui/button";

export function FavouriteButton({ venueId, initialSaved = false }: { venueId: string; initialSaved?: boolean }) {
  const pathname = usePathname();
  const [saved, setSaved] = useState(initialSaved);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2">
      <Button
        aria-pressed={saved}
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const next = !saved;
            setSaved(next);
            const result = await toggleFavourite(venueId, saved, pathname);
            setMessage(result.message);
            if (!result.ok) setSaved(saved);
          });
        }}
        type="button"
        variant={saved ? "primary" : "secondary"}
      >
        <Heart size={16} fill={saved ? "currentColor" : "none"} />
        {saved ? "Saved" : "Save venue"}
      </Button>
      {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
