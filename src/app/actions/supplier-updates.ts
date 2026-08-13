"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { publicSupplierProfilePath } from "@/lib/supplier-public-routes";
import { createClient } from "@/lib/supabase/server";
import type { SupplierCategorySlug } from "@/types/supplier";

export async function approveSupplierUpdateRequest(formData: FormData) {
  await review(formData, "approved");
}

export async function rejectSupplierUpdateRequest(formData: FormData) {
  await review(formData, "rejected");
}

async function review(formData: FormData, decision: "approved" | "rejected"): Promise<never> {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirectWithMessage("Supplier update reviews are not configured yet.");
  const requestId = formData.get("requestId")?.toString().trim() ?? "";
  const adminNotes = formData.get("adminNotes")?.toString().trim().slice(0, 1000) || null;
  if (!requestId) redirectWithMessage("Choose a supplier update request.");
  if (decision === "rejected" && !adminNotes) redirectWithMessage("Add a short reason for the supplier owner.");

  const { data, error } = await supabase.rpc("review_supplier_update_request", { p_request_id: requestId, p_decision: decision, p_admin_notes: adminNotes });
  const result = data?.[0];
  if (error || !result) redirectWithMessage(error?.message ?? "The supplier update was not reviewed.");

  revalidatePath("/admin");
  revalidatePath("/admin/supplier-updates");
  revalidatePath("/vendor");
  revalidatePath(publicSupplierProfilePath(result.category_slug as SupplierCategorySlug, result.supplier_slug));
  redirectWithMessage(decision === "approved" ? "Supplier profile changes approved." : "Supplier profile changes returned to the owner.");
}

function redirectWithMessage(message: string): never {
  redirect(`/admin/supplier-updates?message=${encodeURIComponent(message)}`);
}
