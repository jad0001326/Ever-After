import { SpeedInsights } from "@vercel/speed-insights/next";
import type { ReactNode } from "react";

export default function PlanningHubLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <SpeedInsights />
    </>
  );
}
