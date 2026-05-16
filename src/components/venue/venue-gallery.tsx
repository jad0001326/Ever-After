import Image from "next/image";
import type { Venue } from "@/types/venue";

export function VenueGallery({ venue }: { venue: Venue }) {
  const [hero, ...rest] = venue.images;

  return (
    <section className="grid gap-3 lg:grid-cols-[1.45fr_1fr]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[#eee8dd] lg:aspect-[5/3]">
        <Image alt={hero?.alt ?? venue.name} className="object-cover" fill priority sizes="(min-width: 1024px) 60vw, 100vw" src={hero?.url ?? venue.heroImage} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(rest.length ? rest : venue.images).slice(0, 4).map((image) => (
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-[#eee8dd]" key={image.id}>
            <Image alt={image.alt} className="object-cover" fill sizes="(min-width: 1024px) 20vw, 50vw" src={image.url} />
          </div>
        ))}
      </div>
    </section>
  );
}
