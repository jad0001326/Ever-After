export function supplierAdminSchemaEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.SUPPLIER_ADMIN_SCHEMA_ENABLED === "true";
}
