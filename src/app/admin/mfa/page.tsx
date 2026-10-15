import { redirect } from "next/navigation";
import { db, supabaseSession } from "@/lib/supabase/server";
import { Mfa } from "./Mfa";

// Verifikasi dua langkah (TOTP). Admin yang belum punya faktor diminta mendaftarkan dulu.
export default async function AdminMfa() {
  const sb = await supabaseSession();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) redirect("/admin/masuk");
  const { data: row } = await db().from("admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
  if (!row) redirect("/admin/masuk?bukan=1");
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") redirect("/admin/pembayaran");
  const { data: factors } = await sb.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");
  return (
    <main className="main" style={{ paddingTop: 80 }}>
      <div className="panel stack">
        <h1>Verifikasi dua langkah</h1>
        <Mfa factorId={verified?.id ?? null} />
      </div>
    </main>
  );
}
