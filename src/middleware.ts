import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_IDLE_MS = 30 * 60_000; // keluar otomatis setelah 30 menit tidak aktif

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  await sb.auth.getUser();

  const p = req.nextUrl.pathname;
  const isAdmin = (p.startsWith("/admin") && p !== "/admin/masuk") || p.startsWith("/api/admin");
  if (isAdmin) {
    const last = Number(req.cookies.get("bo_seen")?.value ?? 0);
    if (last && Date.now() - last > ADMIN_IDLE_MS) {
      await sb.auth.signOut();
      const out = NextResponse.redirect(new URL("/admin/masuk?habis=1", req.url));
      res.cookies.getAll().forEach((c) => out.cookies.set(c));
      out.cookies.delete("bo_seen");
      return out;
    }
    res.cookies.set("bo_seen", String(Date.now()), { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp)$).*)"],
};
