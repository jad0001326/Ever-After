-- The original function body over-escaped two PostgreSQL regular expressions.
-- In a SQL string literal `\\.` means a literal backslash followed by any
-- character, rather than a literal full stop. Rebuild the existing function
-- definition with the intended single-backslash expressions.

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(procedure.oid)
  into v_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'verify_enrichment_contact'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_enrichment_record_id uuid, p_email text, p_source_url text, p_verification_method text, p_verification_note text, p_reviewer_id uuid, p_expected_updated_at timestamp with time zone';

  if v_definition is null then
    raise exception 'verify_enrichment_contact function was not found';
  end if;

  v_definition := replace(
    v_definition,
    '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$',
    '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );
  v_definition := replace(v_definition, '^www\\.', '^www\.');

  execute v_definition;
end;
$$;
