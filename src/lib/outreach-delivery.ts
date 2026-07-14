export type OutreachDeliveryStatus = "pending" | "sent" | "delivered" | "failed" | "bounced" | "complained" | "replied" | "unsubscribed" | "suppressed";

export type OutreachDeliverySummary = {
  accepted: number;
  delivered: number;
  bounced: number;
  unsubscribed: number;
  complained: number;
  failed: number;
  suppressed: number;
  pending: number;
};

export function summarizeOutreachDelivery(recipients: Array<{ status: OutreachDeliveryStatus }>): OutreachDeliverySummary {
  const summary: OutreachDeliverySummary = { accepted: recipients.length, delivered: 0, bounced: 0, unsubscribed: 0, complained: 0, failed: 0, suppressed: 0, pending: 0 };
  for (const recipient of recipients) {
    if (recipient.status === "delivered") summary.delivered += 1;
    else if (recipient.status === "bounced") summary.bounced += 1;
    else if (recipient.status === "unsubscribed") summary.unsubscribed += 1;
    else if (recipient.status === "complained") summary.complained += 1;
    else if (recipient.status === "failed") summary.failed += 1;
    else if (recipient.status === "suppressed") summary.suppressed += 1;
    else if (recipient.status === "pending" || recipient.status === "sent") summary.pending += 1;
  }
  return summary;
}
