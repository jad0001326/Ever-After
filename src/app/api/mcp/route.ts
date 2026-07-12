import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import * as z from "zod/v4";
import { authenticateMcpRequest, mcpScopes, mcpUnauthorizedResponse, mcpWwwAuthenticateChallenge } from "@/lib/mcp-auth";
import {
  createOutreachPreview,
  getOutreachCampaign,
  listMissingOutreachContacts,
  listOutreachCandidates,
  sendApprovedOutreachCampaign
} from "@/lib/outreach";
import { defaultOutreachCopy } from "@/lib/outreach-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const securitySchemes = [{ type: "oauth2", scopes: mcpScopes }] as const;
const authMeta = { securitySchemes };

function authenticationRequiredResult() {
  return {
    content: [{ type: "text" as const, text: "Authentication required. Connect as an EverAft administrator to continue." }],
    isError: true,
    _meta: { "mcp/www_authenticate": [mcpWwwAuthenticateChallenge()] }
  };
}

function getAuthenticatedAdminId(extra: { authInfo?: { extra?: Record<string, unknown> } }) {
  const adminUserId = extra.authInfo?.extra?.adminUserId;
  return typeof adminUserId === "string" ? adminUserId : null;
}

function createEverAftMcpServer() {
  const server = new McpServer(
    { name: "EverAft Business Outreach", version: "1.0.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Use the read-only tools to identify an audience and prepare an exact campaign preview first. For missing contacts, research only addresses visibly published on each business's official website, include the exact source page, and never infer or guess an address. Treat approval tokens as opaque secrets and do not display them. Never call outreach_campaign_send until the user has reviewed the exact recipients, sourced contacts, recipient count and sample message and explicitly approved that exact preview."
    }
  );

  server.registerTool(
    "outreach_candidates_list",
    {
      title: "List outreach candidates",
      description: "List eligible EverAft venue businesses after contact validation, deduplication, invite-status filtering and suppression checks. Use this before preparing an invitation campaign.",
      inputSchema: {
        kind: z.enum(["initial_invite", "follow_up"]).default("initial_invite"),
        country: z.string().min(2).max(80).default("Scotland"),
        region: z.string().min(1).max(120).optional(),
        follow_up_after_days: z.number().int().min(1).max(90).default(7),
        limit: z.number().int().min(1).max(100).default(100)
      },
      outputSchema: {
        candidate_count: z.number().int(),
        candidates: z.array(z.object({
          id: z.string(),
          name: z.string(),
          town: z.string(),
          region: z.string(),
          email: z.string(),
          contact_source_url: z.string().nullable()
        })),
        excluded: z.object({ missing_email: z.number().int(), invalid_email: z.number().int(), duplicate_email: z.number().int(), suppressed: z.number().int(), over_limit: z.number().int() })
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
      _meta: { ...authMeta, "openai/toolInvocation/invoking": "Checking eligible venues…", "openai/toolInvocation/invoked": "Eligible venues ready" }
    },
    async ({ country, follow_up_after_days, kind, limit, region }, extra) => {
      if (!getAuthenticatedAdminId(extra)) return authenticationRequiredResult();
      const result = await listOutreachCandidates({
        kind,
        country,
        region,
        followUpAfterDays: follow_up_after_days,
        limit
      });
      const structuredContent = {
        candidate_count: result.candidates.length,
        candidates: result.candidates.map(({ id, name, town, region: candidateRegion, email, contactSourceUrl }) => ({
          id,
          name,
          town,
          region: candidateRegion,
          email,
          contact_source_url: contactSourceUrl
        })),
        excluded: {
          missing_email: result.excluded.missingEmail,
          invalid_email: result.excluded.invalidEmail,
          duplicate_email: result.excluded.duplicateEmail,
          suppressed: result.excluded.suppressed,
          over_limit: result.excluded.overLimit
        }
      };
      return {
        structuredContent,
        content: [{ type: "text", text: `Found ${structuredContent.candidate_count} eligible venue businesses. ${structuredContent.excluded.suppressed} suppressed addresses were excluded.` }]
      };
    }
  );

  server.registerTool(
    "outreach_contacts_missing",
    {
      title: "Find venues needing contact research",
      description: "List eligible unclaimed venue businesses that do not yet have an outreach email, together with each official website. Research only a public business address visibly published on that official website. Do not guess address patterns, use personal addresses, or use data-broker results.",
      inputSchema: {
        country: z.string().min(2).max(80).default("Scotland"),
        region: z.string().min(1).max(120).optional(),
        venue_ids: z.array(z.string().uuid()).max(100).optional(),
        limit: z.number().int().min(1).max(100).default(100)
      },
      outputSchema: {
        research_count: z.number().int(),
        venues: z.array(z.object({
          id: z.string(),
          name: z.string(),
          town: z.string(),
          region: z.string(),
          official_website_url: z.string()
        })),
        missing_official_website: z.number().int(),
        over_limit: z.number().int()
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
      _meta: { ...authMeta, "openai/toolInvocation/invoking": "Finding missing business contacts…", "openai/toolInvocation/invoked": "Contact research list ready" }
    },
    async ({ country, limit, region, venue_ids }, extra) => {
      if (!getAuthenticatedAdminId(extra)) return authenticationRequiredResult();
      const result = await listMissingOutreachContacts({ country, region, venueIds: venue_ids, limit });
      const structuredContent = {
        research_count: result.contacts.length,
        venues: result.contacts.map(({ id, name, town, region: venueRegion, officialWebsiteUrl }) => ({
          id,
          name,
          town,
          region: venueRegion,
          official_website_url: officialWebsiteUrl
        })),
        missing_official_website: result.missingOfficialWebsite,
        over_limit: result.overLimit
      };
      return {
        structuredContent,
        content: [{ type: "text", text: `${structuredContent.research_count} venue businesses need contact research. Use only addresses visibly published on the official websites supplied.` }]
      };
    }
  );

  server.registerTool(
    "outreach_campaign_preview",
    {
      title: "Preview an outreach campaign",
      description: "Create a read-only, expiring preview for an exact audience and EverAft-branded email. Returns a sample, recipient list and approval token without creating records or sending email. Present the result to the user before requesting send approval.",
      inputSchema: {
        campaign_name: z.string().min(1).max(120),
        kind: z.enum(["initial_invite", "follow_up"]).default("initial_invite"),
        country: z.string().min(2).max(80).default("Scotland"),
        region: z.string().min(1).max(120).optional(),
        venue_ids: z.array(z.string().uuid()).max(100).optional(),
        follow_up_after_days: z.number().int().min(1).max(90).default(7),
        limit: z.number().int().min(1).max(100).default(100),
        subject: z.string().min(1).max(160).optional(),
        preheader: z.string().min(1).max(220).optional(),
        intro_text: z.string().min(20).max(2000).optional(),
        offer_text: z.string().min(10).max(1000).optional(),
        researched_contacts: z.array(z.object({
          venue_id: z.string().uuid(),
          email: z.string().email().max(254),
          source_url: z.string().url().max(2048)
        })).max(100).optional()
      },
      outputSchema: {
        campaign_name: z.string(),
        kind: z.string(),
        recipient_count: z.number().int(),
        recipients: z.array(z.object({
          id: z.string(),
          name: z.string(),
          town: z.string(),
          region: z.string(),
          email: z.string(),
          contact_source_url: z.string().nullable(),
          newly_researched: z.boolean()
        })),
        excluded_count: z.number().int(),
        subject_preview: z.string(),
        sample_text: z.string(),
        approval_token: z.string(),
        expires_at: z.string()
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
      _meta: { ...authMeta, "openai/toolInvocation/invoking": "Building branded preview…", "openai/toolInvocation/invoked": "Campaign preview ready" }
    },
    async (args, extra) => {
      const adminUserId = getAuthenticatedAdminId(extra);
      if (!adminUserId) return authenticationRequiredResult();
      const defaults = defaultOutreachCopy[args.kind];
      const preview = await createOutreachPreview({
        adminUserId,
        campaignName: args.campaign_name,
        source: "chatgpt",
        filter: {
          kind: args.kind,
          country: args.country,
          region: args.region,
          venueIds: args.venue_ids,
          followUpAfterDays: args.follow_up_after_days,
          limit: args.limit
        },
        copy: {
          subject: args.subject ?? defaults.subject,
          preheader: args.preheader ?? defaults.preheader,
          introText: args.intro_text ?? defaults.introText,
          offerText: args.offer_text ?? defaults.offerText
        },
        researchedContacts: args.researched_contacts?.map((contact) => ({
          venueId: contact.venue_id,
          email: contact.email,
          sourceUrl: contact.source_url
        }))
      });
      const excludedCount = Object.values(preview.excluded).reduce((total, count) => total + count, 0);
      const structuredContent = {
        campaign_name: preview.campaignName,
        kind: preview.kind,
        recipient_count: preview.recipientCount,
        recipients: preview.recipients.map(({ id, name, town, region, email, contactSourceUrl, contactWasResearched }) => ({
          id,
          name,
          town,
          region,
          email,
          contact_source_url: contactSourceUrl,
          newly_researched: contactWasResearched
        })),
        excluded_count: excludedCount,
        subject_preview: preview.subjectPreview,
        sample_text: preview.sampleText,
        approval_token: preview.approvalToken,
        expires_at: preview.expiresAt
      };
      return {
        structuredContent,
        content: [{ type: "text", text: `Preview ready for ${preview.recipientCount} businesses. Subject: ${preview.subjectPreview}\n\n${preview.sampleText}` }]
      };
    }
  );

  server.registerTool(
    "outreach_campaign_send",
    {
      title: "Send an approved outreach campaign",
      description: "Send the exact previously previewed EverAft campaign, save any exact officially sourced contacts included in that preview, create its audit record, update venue invite status and register delivery IDs. This sends email outside ChatGPT. Call only after the user explicitly approves the exact recipient list, count, sourced contacts and preview, and confirms corporate-subscriber eligibility.",
      inputSchema: {
        approval_token: z.string().min(80).max(100_000),
        confirmed_recipient_count: z.number().int().min(1).max(100),
        corporate_subscriber_eligibility_confirmed: z.literal(true).describe("The user confirmed these are eligible corporate business contacts, not sole traders or personal subscribers.")
      },
      outputSchema: {
        campaign_id: z.string(),
        status: z.string(),
        recipient_count: z.number().int(),
        sent_count: z.number().int(),
        failed_count: z.number().int(),
        skipped_count: z.number().int()
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: true },
      _meta: { ...authMeta, "openai/toolInvocation/invoking": "Sending approved invitations…", "openai/toolInvocation/invoked": "Campaign send completed" }
    },
    async ({ approval_token, confirmed_recipient_count }, extra) => {
      const adminUserId = getAuthenticatedAdminId(extra);
      if (!adminUserId) return authenticationRequiredResult();
      const result = await sendApprovedOutreachCampaign({
        adminUserId,
        approvalToken: approval_token,
        confirmedRecipientCount: confirmed_recipient_count
      });
      const structuredContent = {
        campaign_id: result.campaignId,
        status: result.status,
        recipient_count: result.recipientCount,
        sent_count: result.sentCount,
        failed_count: result.failedCount,
        skipped_count: result.skippedCount
      };
      return {
        structuredContent,
        content: [{ type: "text", text: `Campaign ${result.status}: ${result.sentCount} sent, ${result.failedCount} failed and ${result.skippedCount} suppressed.` }]
      };
    }
  );

  server.registerTool(
    "outreach_campaign_status",
    {
      title: "Check outreach campaign status",
      description: "Read the current status and recipient delivery states for one EverAft outreach campaign.",
      inputSchema: { campaign_id: z.string().uuid() },
      outputSchema: {
        campaign_id: z.string(),
        name: z.string(),
        status: z.string(),
        recipient_count: z.number().int(),
        sent_count: z.number().int(),
        failed_count: z.number().int(),
        skipped_count: z.number().int(),
        recipient_statuses: z.record(z.string(), z.number().int())
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
      _meta: { ...authMeta, "openai/toolInvocation/invoking": "Checking campaign status…", "openai/toolInvocation/invoked": "Campaign status ready" }
    },
    async ({ campaign_id }, extra) => {
      if (!getAuthenticatedAdminId(extra)) return authenticationRequiredResult();
      const { campaign, recipients } = await getOutreachCampaign(campaign_id);
      const recipientStatuses: Record<string, number> = {};
      for (const recipient of recipients) recipientStatuses[recipient.status] = (recipientStatuses[recipient.status] ?? 0) + 1;
      const structuredContent = {
        campaign_id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        recipient_count: campaign.recipient_count,
        sent_count: campaign.sent_count,
        failed_count: campaign.failed_count,
        skipped_count: campaign.skipped_count,
        recipient_statuses: recipientStatuses
      };
      return { structuredContent, content: [{ type: "text", text: `${campaign.name} is ${campaign.status}. ${campaign.sent_count}/${campaign.recipient_count} were accepted for delivery.` }] };
    }
  );

  return server;
}

async function handleMcpRequest(request: Request) {
  const authInfo = await authenticateMcpRequest(request);
  if (!authInfo && request.method !== "POST") return withCors(mcpUnauthorizedResponse());

  const server = createEverAftMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  try {
    await server.connect(transport);
    return withCors(await transport.handleRequest(request, { authInfo: authInfo ?? undefined }));
  } finally {
    await transport.close();
    await server.close();
  }
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
    "Access-Control-Expose-Headers": "MCP-Protocol-Version, MCP-Session-Id, WWW-Authenticate"
  };
}
