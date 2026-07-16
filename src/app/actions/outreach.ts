"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminCampaignDraft, recordOutreachRecipientAction, sendCampaignById, unsubscribeOutreachRecipient } from "@/lib/outreach";
import { defaultOutreachCopyFor, type OutreachAudienceType, type OutreachCampaignKind } from "@/lib/outreach-email";

export async function createOutreachCampaignDraftAction(formData: FormData) {
  const { user } = await requireAdmin();
  const entityIds = Array.from(new Set(formData.getAll("entityIds").map((value) => value.toString()).filter(Boolean))).slice(0, 100);
  const kind: OutreachCampaignKind = formData.get("kind")?.toString() === "follow_up" ? "follow_up" : "initial_invite";
  const audienceType: OutreachAudienceType = formData.get("audienceType")?.toString() === "photographer" ? "photographer" : "venue";
  const fallback = defaultOutreachCopyFor(audienceType, kind);
  const returnUrl = `/admin/outreach?audience=${audienceType}&kind=${kind}`;

  if (entityIds.length === 0) redirect(`${returnUrl}&message=Select+at+least+one+eligible+business`);
  if (formData.get("complianceConfirmed") !== "on") {
    redirect(`${returnUrl}&message=Confirm+the+recipient+eligibility+and+opt-out+statement+before+creating+a+campaign`);
  }

  try {
    const campaign = await createAdminCampaignDraft({
      adminUserId: user.id,
      campaignName: formData.get("campaignName")?.toString() || `EverAft ${audienceType} invitation ${new Date().toLocaleDateString("en-GB")}`,
      filter: {
        kind,
        audienceType,
        country: formData.get("country")?.toString() || "Scotland",
        region: formData.get("region")?.toString() || undefined,
        venueIds: audienceType === "venue" ? entityIds : undefined,
        supplierIds: audienceType === "photographer" ? entityIds : undefined,
        followUpAfterDays: Number(formData.get("followUpAfterDays") || 7),
        limit: entityIds.length
      },
      copy: {
        subject: formData.get("subject")?.toString() || fallback.subject,
        preheader: formData.get("preheader")?.toString() || fallback.preheader,
        introText: formData.get("introText")?.toString() || fallback.introText,
        offerText: formData.get("offerText")?.toString() || fallback.offerText
      }
    });
    redirect(`/admin/outreach/campaigns/${campaign.id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof Error ? error.message : "Could not create campaign.";
    redirect(`${returnUrl}&message=${encodeURIComponent(message)}`);
  }
}

export async function sendOutreachCampaignAction(formData: FormData) {
  const { user } = await requireAdmin();
  const campaignId = formData.get("campaignId")?.toString();
  if (!campaignId) redirect("/admin/outreach?message=Campaign+is+required");
  if (formData.get("approvalConfirmed") !== "on") {
    redirect(`/admin/outreach/campaigns/${campaignId}?message=Confirm+the+recipient+list+and+email+preview+before+sending`);
  }

  try {
    const result = await sendCampaignById(campaignId, user.id);
    revalidatePath("/admin");
    revalidatePath("/admin/outreach");
    revalidatePath(`/admin/outreach/campaigns/${campaignId}`);
    redirect(
      `/admin/outreach/campaigns/${campaignId}?message=${encodeURIComponent(
        `Campaign ${result.status}: ${result.sentCount} sent, ${result.failedCount} failed, ${result.skippedCount} suppressed`
      )}`
    );
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof Error ? error.message : "Could not send campaign.";
    redirect(`/admin/outreach/campaigns/${campaignId}?message=${encodeURIComponent(message)}`);
  }
}

export async function unsubscribeOutreachAction(formData: FormData) {
  const recipientId = formData.get("recipientId")?.toString() ?? "";
  const token = formData.get("token")?.toString() ?? "";
  const result = await unsubscribeOutreachRecipient(recipientId, token);
  redirect(`/outreach/unsubscribe?status=${result.ok ? "success" : "invalid"}`);
}

export async function updateOutreachRecipientAction(formData: FormData) {
  const { user } = await requireAdmin();
  const campaignId = formData.get("campaignId")?.toString();
  const recipientId = formData.get("recipientId")?.toString();
  const action = formData.get("recipientAction")?.toString();
  if (!campaignId || !recipientId || (action !== "replied" && action !== "suppress")) {
    redirect("/admin/outreach?message=Choose+a+valid+recipient+action");
  }

  try {
    await recordOutreachRecipientAction({ action, adminUserId: user.id, recipientId });
    revalidatePath("/admin/outreach");
    revalidatePath(`/admin/outreach/campaigns/${campaignId}`);
    redirect(`/admin/outreach/campaigns/${campaignId}?message=${action === "replied" ? "Reply+recorded" : "Address+suppressed"}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof Error ? error.message : "Could not update the recipient.";
    redirect(`/admin/outreach/campaigns/${campaignId}?message=${encodeURIComponent(message)}`);
  }
}

function isNextRedirect(error: unknown) {
  return Boolean(error && typeof error === "object" && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT"));
}
