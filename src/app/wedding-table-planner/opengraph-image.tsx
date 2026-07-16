import { ImageResponse } from "next/og";

export const alt = "EverAft free wedding table planner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ alignItems: "stretch", background: "#fbfaf7", color: "#24432f", display: "flex", height: "100%", padding: "58px 64px", width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", width: "58%" }}>
        <div style={{ fontFamily: "serif", fontSize: 48 }}>EverAft</div>
        <div style={{ background: "#d7c49d", height: 2, marginTop: 22, width: 190 }} />
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "serif", fontSize: 78, fontWeight: 600, lineHeight: 0.95, marginTop: 72 }}>
          <span>Wedding table</span><span>planner</span>
        </div>
        <div style={{ color: "#625f57", display: "flex", fontSize: 26, lineHeight: 1.35, marginTop: 32, width: "590px" }}>Add guests, set who should sit together or apart, then generate an editable arrangement.</div>
      </div>
      <div style={{ alignItems: "center", background: "#24432f", borderRadius: 38, display: "flex", justifyContent: "center", width: "42%" }}>
        <div style={{ alignItems: "center", background: "#f5ead8", border: "5px solid #c8ac82", borderRadius: 999, color: "#24432f", display: "flex", flexDirection: "column", height: 270, justifyContent: "center", width: 270 }}>
          <div style={{ display: "flex", fontFamily: "serif", fontSize: 42, fontWeight: 600 }}>Your table</div>
          <div style={{ display: "flex", fontSize: 22, marginTop: 12 }}>8 guests</div>
        </div>
      </div>
    </div>,
    size,
  );
}
