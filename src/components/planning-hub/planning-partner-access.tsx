"use client";

import { Copy, Link2, UserRoundPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  createPlanningWorkspaceInviteAction,
  revokePlanningWorkspaceInviteAction,
} from "@/app/actions/planning-workspace";
import type { PlanningWorkspaceCloudSnapshot } from "@/lib/planning-workspace/cloud";

export function PlanningPartnerAccess({
  cloudEnabled,
  snapshot,
  userId,
}: {
  cloudEnabled: boolean;
  snapshot: PlanningWorkspaceCloudSnapshot | null;
  userId: string | null;
}) {
  const [invites, setInvites] = useState(snapshot?.invites ?? []);
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!cloudEnabled || !userId || !snapshot) return null;
  const connectedSnapshot = snapshot;

  const isOwner = connectedSnapshot.workspace.owner_id === userId;
  if (!isOwner) {
    return (
      <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs leading-5 text-[#31533b]">
        You have partner access to this connected plan. Changes are protected by your signed-in membership.
      </p>
    );
  }

  const unusedInvites = invites.filter(
    (invite) => !invite.accepted_at && !invite.revoked_at,
  );
  const partnerCount = connectedSnapshot.members.filter((member) => member.role === "partner").length;

  function createInvite() {
    setFeedback(null);
    setInviteUrl(null);
    startTransition(async () => {
      const result = await createPlanningWorkspaceInviteAction({
        workspaceId: connectedSnapshot.workspace.id,
        email,
      });
      if (!result.ok) {
        setFeedback(result.message);
        return;
      }
      setInvites((current) => [result.invite, ...current]);
      setInviteUrl(result.inviteUrl);
      setEmail("");
      setFeedback("Invitation created. Copy this private link now; it is shown only once.");
    });
  }

  function revokeInvite(inviteId: string) {
    setFeedback(null);
    startTransition(async () => {
      const result = await revokePlanningWorkspaceInviteAction(inviteId);
      if (!result.ok) {
        setFeedback(result.message);
        return;
      }
      const revokedAt = new Date().toISOString();
      setInvites((current) => current.map((invite) => (
        invite.id === inviteId ? { ...invite, revoked_at: revokedAt } : invite
      )));
      setFeedback("The unused invitation was revoked.");
    });
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setFeedback("Private invitation link copied.");
    } catch {
      setFeedback("Copy was blocked by this browser. Select and copy the link below.");
    }
  }

  return (
    <section aria-label="Partner invitation management" className="mt-4 rounded-2xl bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#173526]">Invite your partner</p>
        <span className="text-xs text-[#625f57]">{partnerCount} connected</span>
      </div>
      <label className="mt-3 grid gap-1 text-xs font-semibold text-[#514b43]">
        Partner email
        <input
          autoComplete="email"
          className="focus-ring min-h-11 rounded-xl border border-[#cfc3b3] px-3 text-sm"
          disabled={pending}
          maxLength={254}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="partner@example.com"
          type="email"
          value={email}
        />
      </label>
      <button
        className="focus-ring mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#173526] px-4 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending || !email}
        onClick={createInvite}
        type="button"
      >
        <UserRoundPlus size={16} /> {pending ? "Working…" : "Create private invitation"}
      </button>

      {inviteUrl ? (
        <div className="mt-3 rounded-xl bg-[#eef4ef] p-3">
          <p className="break-all text-xs leading-5 text-[#31533b]">{inviteUrl}</p>
          <button className="focus-ring mt-2 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#9fb3a2] px-3 text-xs font-semibold text-[#173526]" onClick={copyInvite} type="button">
            <Copy size={14} /> Copy link
          </button>
        </div>
      ) : null}

      {unusedInvites.length > 0 ? (
        <ul className="mt-4 grid gap-2" aria-label="Unused invitations">
          {unusedInvites.map((invite) => (
            <li className="flex items-center gap-2 rounded-xl border border-[#e5ddd1] p-3" key={invite.id}>
              <Link2 className="shrink-0 text-[#31533b]" size={15} />
              <span className="min-w-0 flex-1 truncate text-xs text-[#4f504a]">{invite.email_normalized}</span>
              <button aria-label={`Revoke invitation for ${invite.email_normalized}`} className="focus-ring grid size-10 place-items-center rounded-full text-[#8b452d]" disabled={pending} onClick={() => revokeInvite(invite.id)} type="button">
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {feedback ? <p aria-live="polite" className="mt-3 text-xs leading-5 text-[#625f57]" role="status">{feedback}</p> : null}
    </section>
  );
}
