import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createPlanningWorkspaceInviteAction } from "@/app/actions/planning-workspace";
import type { PlanningWorkspaceCloudSnapshot } from "@/lib/planning-workspace/cloud";
import { PlanningPartnerAccess } from "./planning-partner-access";

vi.mock("@/app/actions/planning-workspace", () => ({
  createPlanningWorkspaceInviteAction: vi.fn(),
  revokePlanningWorkspaceInviteAction: vi.fn(),
}));

const snapshot = {
  workspace: {
    id: "60000000-0000-4000-8000-000000000006",
    owner_id: "owner-1",
    budget_plan_id: "budget-1",
    name: "Our wedding plan",
    created_at: "2026-07-26T10:00:00.000Z",
    updated_at: "2026-07-26T10:00:00.000Z",
  },
  profile: null,
  members: [{
    workspace_id: "60000000-0000-4000-8000-000000000006",
    user_id: "owner-1",
    role: "owner",
    created_at: "2026-07-26T10:00:00.000Z",
  }],
  invites: [],
  tasks: [],
  guests: [],
  tables: [],
  seats: [],
  seatingRules: [],
} satisfies PlanningWorkspaceCloudSnapshot;

describe("PlanningPartnerAccess", () => {
  it("creates a one-time private invitation for the workspace owner", async () => {
    vi.mocked(createPlanningWorkspaceInviteAction).mockResolvedValue({
      ok: true,
      inviteUrl: "https://www.everaft.co.uk/planning-hub/join/redeem?token=private",
      invite: {
        id: "70000000-0000-4000-8000-000000000007",
        workspace_id: snapshot.workspace.id,
        email_normalized: "partner@example.com",
        role: "partner",
        expires_at: "2026-08-02T10:00:00.000Z",
        accepted_at: null,
        accepted_by: null,
        revoked_at: null,
        created_at: "2026-07-26T10:00:00.000Z",
      },
    });

    render(<PlanningPartnerAccess cloudEnabled snapshot={snapshot} userId="owner-1" />);
    fireEvent.change(screen.getByLabelText("Partner email"), {
      target: { value: "partner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create private invitation" }));

    await waitFor(() => expect(createPlanningWorkspaceInviteAction).toHaveBeenCalledWith({
      workspaceId: snapshot.workspace.id,
      email: "partner@example.com",
    }));
    expect(await screen.findByText(/token=private/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revoke invitation for partner@example.com" })).toBeTruthy();
  });

  it("shows membership status without owner controls to a partner", () => {
    render(<PlanningPartnerAccess cloudEnabled snapshot={snapshot} userId="partner-1" />);
    expect(screen.getByText(/You have partner access/)).toBeTruthy();
    expect(screen.queryByLabelText("Partner email")).toBeNull();
  });
});
