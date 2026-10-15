import { NextResponse, type NextRequest } from "next/server";
import { supabaseSession } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const sb = await supabaseSession();
  await sb.auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), 303);
}
