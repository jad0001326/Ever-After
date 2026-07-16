-- Trusted server-side admin pages use the service role after requireAdmin()
-- has authenticated and authorised the caller. New tables do not receive the
-- API data privileges automatically, so grant only the required CRUD actions.

grant select, insert, update, delete on table
  public.supplier_categories,
  public.supplier_listings,
  public.photographer_profiles,
  public.supplier_images,
  public.supplier_venue_connections,
  public.supplier_favourites
to service_role;

notify pgrst, 'reload schema';
