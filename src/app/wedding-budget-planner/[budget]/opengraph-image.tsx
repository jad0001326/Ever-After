import { ImageResponse } from "next/og";
import { getBudgetStarter } from "@/lib/budget/starters";

export const alt = "An editable EverAft wedding budget example";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "edge";

export default async function OpenGraphImage({ params }: { params: Promise<{ budget: string }> }) {
  const { budget } = await params;
  const starter = getBudgetStarter(budget) ?? getBudgetStarter("20000")!;
  const formattedBudget = `£${Number(starter.slug).toLocaleString("en-GB")}`;
  const highlights = starter.allocations.slice(0, 3).map((allocation) => ({
    label: allocation.itemName.replace(" estimate", ""),
    value: `£${(allocation.amountPence / 100).toLocaleString("en-GB")}`
  }));

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #f8f2e8 0%, #fffaf2 48%, #e5d4bd 100%)",
          color: "#152017",
          display: "flex",
          height: "100%",
          overflow: "hidden",
          padding: "54px 62px",
          position: "relative",
          width: "100%"
        }}
      >
        <div
          style={{
            border: "2px solid rgba(156,84,45,0.32)",
            borderRadius: "315px 315px 0 0",
            display: "flex",
            height: "540px",
            position: "absolute",
            right: "-76px",
            top: "96px",
            width: "470px"
          }}
        />
        <div
          style={{
            background: "#24432f",
            borderRadius: "999px",
            display: "flex",
            height: "220px",
            opacity: 0.09,
            position: "absolute",
            right: "70px",
            top: "-82px",
            width: "220px"
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", position: "relative", width: "100%" }}>
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <div style={{ display: "flex", fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 600, letterSpacing: "1px" }}>EverAft</div>
            <div style={{ color: "#95502b", display: "flex", fontSize: 18, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase" }}>Free editable planner</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: "820px" }}>
            <div style={{ color: "#95502b", display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase" }}>{starter.title}</div>
            <div style={{ display: "flex", fontFamily: "Georgia, serif", fontSize: 88, fontWeight: 600, letterSpacing: "-3px", lineHeight: 0.95, marginTop: "14px" }}>{formattedBudget}</div>
            <div style={{ display: "flex", fontFamily: "Georgia, serif", fontSize: 47, lineHeight: 1, marginTop: "8px" }}>wedding budget example</div>
            <div style={{ color: "#625f57", display: "flex", fontSize: 22, lineHeight: 1.35, marginTop: "20px", width: "770px" }}>A practical starting framework for around {starter.suggestedGuests} guests. Change every estimate to fit your day.</div>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            {highlights.map((highlight) => (
              <div key={highlight.label} style={{ background: "rgba(255,255,255,0.78)", border: "1px solid rgba(156,84,45,0.22)", borderRadius: "16px", display: "flex", flexDirection: "column", minWidth: "212px", padding: "13px 17px" }}>
                <div style={{ color: "#6a5b42", display: "flex", fontSize: 16 }}>{highlight.label}</div>
                <div style={{ display: "flex", fontSize: 23, fontWeight: 700, marginTop: "3px" }}>{highlight.value}</div>
              </div>
            ))}
            <div style={{ alignItems: "center", background: "#24432f", borderRadius: "16px", color: "white", display: "flex", fontSize: 18, fontWeight: 700, justifyContent: "center", marginLeft: "auto", padding: "13px 24px" }}>Plan free on EverAft</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
