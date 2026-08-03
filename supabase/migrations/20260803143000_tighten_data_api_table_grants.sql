-- Remove schema-level capabilities that the browser-facing Data API roles do
-- not need. Row level security does not apply to TRUNCATE, and application
-- clients do not create foreign keys or table triggers.

revoke truncate, trigger, references on table
  public.amenities,
  public.enquiries,
  public.favourites,
  public.photographer_profiles,
  public.profiles,
  public.supplier_categories,
  public.supplier_claims,
  public.supplier_favourites,
  public.supplier_images,
  public.supplier_listings,
  public.supplier_venue_connections,
  public.vendor_update_requests,
  public.vendor_users,
  public.vendors,
  public.venue_amenities,
  public.venue_claim_audit_log,
  public.venue_claims,
  public.venue_images,
  public.venues
from anon, authenticated;

notify pgrst, 'reload schema';
