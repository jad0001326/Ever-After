"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { sendListingReminders } from "@/lib/listing-reminders";

const returnPath = "/admin/listing-reminders";

export async function sendListingRemindersAction(formData: FormData) {
  const { user } = await requireAdmin();
  const venueIds = Array.from(new Set(formData.getAll("venueIds").map((value) => value.toString()).filter(Boolean)));

  if (venueIds.length === 0) redirect(`${returnPath}?message=Select+at+least+one+eligible+registered+account`);
  if (venueIds.length > 100) redirect(`${returnPath}?message=Listing+reminder+sends+are+limited+to+100+accounts+at+a+time`);
  if (formData.get("sendConfirmed") !== "on") {
    redirect(`${returnPath}?message=Confirm+the+recipients+and+rich+email+preview+before+sending`);
  }

  let message: string;
  try {
    const result = await sendListingReminders({ adminUserId: user.id, venueIds });
    message = `${result.sent} reminder${result.sent === 1 ? "" : "s"} sent, ${result.failed} failed and ${result.skipped} skipped after the final eligibility check.`;
    if (result.trackingFailed > 0) {
      message += ` ${result.trackingFailed} successful send${result.trackingFailed === 1 ? " was" : "s were"} not written to the audit log; check Resend before retrying.`;
    }
  } catch (error) {
    message = error instanceof Error ? error.message : "The listing reminders could not be sent.";
  }

  revalidatePath("/admin");
  revalidatePath(returnPath);
  redirect(`${returnPath}?message=${encodeURIComponent(message)}`);
}
