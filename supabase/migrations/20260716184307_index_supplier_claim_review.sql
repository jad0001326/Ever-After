-- Cover claim ownership and reviewer foreign keys used by the authenticated
-- claim view and the admin audit trail.

create index if not exists supplier_claims_claimant_user_idx
  on public.supplier_claims (claimant_user_id, created_at desc);

create index if not exists supplier_claim_audit_log_admin_idx
  on public.supplier_claim_audit_log (admin_user_id, created_at desc)
  where admin_user_id is not null;
