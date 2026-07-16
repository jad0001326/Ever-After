"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { submitSupplierClaim } from "@/app/actions/claims";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

export function SupplierClaimForm({ supplierId, supplierSlug }: { supplierId: string; supplierSlug: string }) {
  const [state, formAction, pending] = useActionState(submitSupplierClaim, null);
  return <form action={formAction} className="rounded-3xl border border-[var(--line)] bg-white p-6">
    <input name="supplierId" type="hidden" value={supplierId} /><input name="slug" type="hidden" value={supplierSlug} />
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Your name"><Input name="claimantName" required /></Field><Field label="Business email"><Input name="businessEmail" required type="email" /></Field><Field label="Role"><Input name="claimantRole" required placeholder="Owner, director, studio manager" /></Field><Field label="Phone number"><Input name="businessPhone" required /></Field></div>
    <div className="mt-4 grid gap-4"><Field label="Evidence URL"><Input name="evidenceUrl" placeholder="Website team page, LinkedIn, or official contact page" type="url" /></Field><Field label="Message"><Textarea minLength={10} name="message" required placeholder="Tell us how you are connected to this photography business." /></Field></div>
    <div className="mt-5 grid gap-3 rounded-2xl bg-[#fbf8f3] p-4 text-sm text-[#4a443c]"><label className="flex gap-3"><input className="mt-1 size-4 accent-[#334235]" name="authorised" required type="checkbox" /><span>I am authorised to represent this business.</span></label><label className="flex gap-3"><input className="mt-1 size-4 accent-[#334235]" name="permissionConfirmed" required type="checkbox" /><span>I will only provide portfolio content I own or have permission to share.</span></label><label className="flex gap-3"><input className="mt-1 size-4 accent-[#334235]" name="termsAccepted" required type="checkbox" /><span>I agree that EverAft may display content after review and approval.</span></label></div>
    {state?.message ? <p className={state.ok ? "mt-5 rounded-2xl bg-[#eef4ea] px-4 py-3 text-sm text-[#3f5c35]" : "mt-5 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19]"}>{state.message}</p> : null}
    <Button className="mt-5 w-full" disabled={pending || state?.ok} type="submit"><ShieldCheck size={16} />{pending ? "Submitting..." : "Submit claim for review"}</Button>
  </form>;
}
