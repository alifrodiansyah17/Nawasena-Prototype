// Cek izin backoffice (RBAC) atas nama admin yang memanggil.
// Memakai fungsi database izin(menu, aksi) dengan JWT si admin, jadi aturan sesi 24 jam ikut berlaku.
import { createClient } from "npm:@supabase/supabase-js@2";
import { env, kunciPublik } from "./umum.ts";

export async function punyaIzin(req: Request, menu: string, aksi: "r" | "c" | "u" | "d"): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const c = createClient(env("SUPABASE_URL"), kunciPublik(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.rpc("izin", { p_menu: menu, p_aksi: aksi });
  return !error && data === true;
}
