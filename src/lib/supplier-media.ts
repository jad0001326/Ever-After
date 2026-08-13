type SupplierImagePermission = "representative" | "pending" | "approved" | "rejected";

export function permittedSupplierHero(
  imageUrl: string | null,
  permissionStatus: SupplierImagePermission,
) {
  return imageUrl && (permissionStatus === "approved" || permissionStatus === "representative")
    ? imageUrl
    : null;
}
