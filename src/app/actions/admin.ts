"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function upsertVenue(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect("/admin?message=Connect+Supabase+to+persist+venue+changes");

  const id = formData.get("id")?.toString();
  const name = formData.get("name")?.toString() ?? "";
  const status: "draft" | "published" = formData.get("status")?.toString() === "draft" ? "draft" : "published";
  const payload = {
    slug: formData.get("slug")?.toString() || slugify(name),
    name,
    type: formData.get("type")?.toString() ?? "Country Estate",
    region: formData.get("region")?.toString() ?? "",
    town: formData.get("town")?.toString() ?? "",
    summary: formData.get("summary")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    price_from: Number(formData.get("priceFrom")) || 0,
    price_to: Number(formData.get("priceTo")) || 0,
    capacity_min: Number(formData.get("capacityMin")) || 0,
    capacity_max: Number(formData.get("capacityMax")) || 0,
    hero_image: formData.get("heroImage")?.toString() ?? "",
    is_featured: formData.get("isFeatured") === "on",
    status
  };

  const { error } = id
    ? await supabase.from("venues").update(payload).eq("id", id)
    : await supabase.from("venues").insert(payload);

  if (error) redirect(`/admin?message=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin");
  revalidatePath("/venues");
  redirect("/admin?message=Venue+saved");
}
