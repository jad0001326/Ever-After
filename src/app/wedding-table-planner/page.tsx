import type { Metadata } from "next";
import { TablePlanner } from "@/components/table-plan/table-planner";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Free Wedding Table Planner",
  description: "Add guests, set who should sit together or apart, generate an editable wedding seating arrangement and export the finished table plan.",
  path: "/wedding-table-planner",
  keywords: ["free wedding table planner", "wedding seating plan generator", "wedding table plan UK", "wedding guest seating planner"],
});

export default function WeddingTablePlannerPage() {
  return <TablePlanner />;
}
