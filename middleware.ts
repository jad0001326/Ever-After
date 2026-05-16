import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/utils/supabase/config";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next({ request });
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
