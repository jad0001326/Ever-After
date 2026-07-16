import Image from "next/image";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

export function SupplierVisual({
  imageUrl,
  name,
  priority = false,
  className
}: {
  imageUrl: string | null;
  name: string;
  priority?: boolean;
  className?: string;
}) {
  if (imageUrl) {
    return <Image alt={`${name} wedding photography`} className={cn("object-cover", className)} fill priority={priority} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" src={imageUrl} />;
  }

  return (
    <div aria-label={`${name} EverAft profile cover. Approved portfolio photography is being added.`} className={cn("absolute inset-0 grid place-items-center overflow-hidden bg-[#e9e0d2]", className)} role="img">
      <div className="absolute -right-12 -top-14 size-48 rounded-full border border-[#c3a982]/55" />
      <div className="absolute -bottom-16 -left-10 size-56 rounded-full border border-[#8a9b83]/55" />
      <div className="relative text-center text-[#314537]">
        <span className="mx-auto grid size-16 place-items-center rounded-full border border-[#8e806d]/40 bg-white/55 backdrop-blur"><Camera size={25} strokeWidth={1.6} /></span>
        <span className="mt-4 block font-display text-4xl font-semibold">{name.slice(0, 1).toUpperCase()}</span>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#746957]">EverAft photographer</span>
      </div>
    </div>
  );
}

