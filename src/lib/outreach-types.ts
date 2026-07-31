import type { OutreachAudienceType, OutreachCampaignKind, OutreachCopy } from "@/lib/outreach-email";
import type { OutreachFollowUpStage } from "@/lib/outreach-sequence";

export type OutreachAudienceFilter = {
  kind: OutreachCampaignKind;
  audienceType?: OutreachAudienceType;
  country?: string;
  region?: string;
  venueIds?: string[];
  supplierIds?: string[];
  followUpAfterDays?: number;
  followUpStage?: OutreachFollowUpStage;
  limit?: number;
};

export type OutreachCandidate = {
  audienceType: OutreachAudienceType;
  id: string;
  slug: string;
  name: string;
  town: string;
  region: string;
  country: string;
  email: string;
  contactSourceUrl: string | null;
  contactWasResearched: boolean;
};

export type ResearchedOutreachContact = {
  venueId: string;
  email: string;
  sourceUrl: string;
};

export type MissingOutreachContact = {
  id: string;
  slug: string;
  name: string;
  town: string;
  region: string;
  country: string;
  officialWebsiteUrl: string;
};

export type OutreachPreviewInput = {
  adminUserId: string;
  campaignName: string;
  source: "admin" | "chatgpt";
  filter: OutreachAudienceFilter;
  copy: OutreachCopy;
  researchedContacts?: ResearchedOutreachContact[];
};
