import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabasePublishableKey, supabaseUrl } from "./config";

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl!, supabasePublishableKey!);
}
