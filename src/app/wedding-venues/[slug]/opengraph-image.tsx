import { ImageResponse } from "next/og";
import { getVenueCollection } from "@/lib/venue-collections";

export const alt = "Explore Scottish wedding venues on EverAft";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = getVenueCollection(slug) ?? getVenueCollection("stirling")!;

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #152017 0%, #24432f 58%, #8d5a3a 140%)",
          color: "white",
          display: "flex",
          height: "100%",
          overflow: "hidden",
          padding: "58px 66px",
          position: "relative",
          width: "100%"
        }}
      >
        <div
          style={{
            border: "2px solid rgba(225,182,146,0.35)",
            borderRadius: "320px 320px 0 0",
            display: "flex",
            height: "560px",
            position: "absolute",
            right: "-65px",
            top: "110px",
            width: "460px"
          }}
        />
        <div
          style={{
            background: "rgba(225,182,146,0.1)",
            borderRadius: "999px",
            display: "flex",
            height: "270px",
            position: "absolute",
            right: "65px",
            top: "-100px",
            width: "270px"
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", position: "relative", width: "100%" }}>
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <div style={{ display: "flex", fontFamily: "Georgia, serif", fontSize: 46, letterSpacing: "1px" }}>EverAft</div>
            <div style={{ color: "#e1b692", display: "flex", fontSize: 18, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase" }}>Scottish venue guide</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", width: "880px" }}>
            <div style={{ color: "#e1b692", display: "flex", fontSize: 21, fontWeight: 700, letterSpacing: "4px", textTransform: "uppercase" }}>Compare places, prices and practical details</div>
            <div style={{ display: "flex", fontFamily: "Georgia, serif", fontSize: collection.title.length > 30 ? 70 : 80, letterSpacing: "-2px", lineHeight: 0.98, marginTop: "20px" }}>{collection.title}</div>
            <div style={{ color: "rgba(255,255,255,0.76)", display: "flex", fontSize: 23, lineHeight: 1.35, marginTop: "24px", width: "810px" }}>{collection.description}</div>
          </div>

          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <div style={{ color: "rgba(255,255,255,0.7)", display: "flex", fontSize: 19 }}>Build a shortlist, then test it in your wedding budget.</div>
            <div style={{ background: "#ad5d32", borderRadius: "999px", display: "flex", fontSize: 19, fontWeight: 700, padding: "15px 25px" }}>Explore free on EverAft</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
