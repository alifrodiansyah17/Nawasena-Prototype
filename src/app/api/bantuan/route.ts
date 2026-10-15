import { NextResponse, type NextRequest } from "next/server";
import { waLink } from "@/lib/config";
import { currentUser } from "@/lib/session";
import { track } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  const layar = req.nextUrl.searchParams.get("layar") ?? "tidak diketahui";
  const user = await currentUser().catch(() => null);
  await track(user?.id ?? null, "help_click", { layar });
  return NextResponse.redirect(waLink());
}
