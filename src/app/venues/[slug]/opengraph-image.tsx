import { ImageResponse } from "next/og";
import { shouldUseVenuePassport } from "@/lib/venue-images";
import { getVenueListingBySlug } from "@/lib/venues";

export const alt = "Discover a wedding venue on EverAft";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = await getVenueListingBySlug(slug);
  const imageUrl = venue && !shouldUseVenuePassport(venue) ? venue.heroImage : null;
  const location = venue ? `${venue.town}, ${venue.region}` : "Thoughtful UK wedding venues";

  return new ImageResponse(
    (
      <div
        style={{
          background: "#152017",
          display: "flex",
          height: "100%",
          overflow: "hidden",
          position: "relative",
          width: "100%"
        }}
      >
        {imageUrl ? (
          <img
            alt=""
            height="630"
            src={imageUrl}
            style={{ height: "100%", objectFit: "cover", position: "absolute", width: "100%" }}
            width="1200"
          />
        ) : null}
        <div
          style={{
            background: "linear-gradient(90deg, rgba(21,32,23,0.98) 0%, rgba(21,32,23,0.93) 43%, rgba(21,32,23,0.3) 78%, rgba(21,32,23,0.08) 100%)",
            display: "flex",
            inset: 0,
            position: "absolute"
          }}
        />
        <div
          style={{
            color: "white",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "space-between",
            padding: "62px 68px",
            position: "relative",
            width: "760px"
          }}
        >
          <div style={{ display: "flex", fontFamily: "Georgia, serif", fontSize: 48, letterSpacing: "-1px" }}>EverAft</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#e1b692", display: "flex", fontSize: 21, fontWeight: 600, letterSpacing: "4px", textTransform: "uppercase" }}>
              {venue?.type ?? "Wedding venues"}
            </div>
            <div style={{ display: "flex", fontFamily: "Georgia, serif", fontSize: venue && venue.name.length > 27 ? 62 : 72, lineHeight: 0.95, marginTop: 18 }}>
              {venue?.name ?? "Find a venue worth remembering"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.78)", display: "flex", fontSize: 25, marginTop: 22 }}>{location}</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
