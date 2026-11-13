// POST /functions/v1/login — login pengguna & backoffice: password + verifikasi dua langkah (kode email / Authenticator).
// Sesi Supabase hanya diberikan setelah kedua langkah lolos (izin_login sekali pakai + hook_token di database).
//
// Tanpa sesi:
//   { aksi: "sandi", peran: "pengguna"|"admin", akun, sandi }  → { tantangan, tahap: email|totp|pilih, tujuan }
//   { aksi: "pilih", tantangan, metode: "email"|"totp" }        → admin pertama kali: email → kode dikirim; totp → { qr, rahasia }
//   { aksi: "kirim_ulang", tantangan }                          → kirim ulang kode email (jeda 60 detik)
//   { aksi: "verifikasi", tantangan, kode }                     → { access_token, refresh_token }
//   { aksi: "daftar_kirim", email }                             → kode ke email calon pengguna
//   { aksi: "daftar_cek", tantangan, kode, sandi }              → akun dibuat + sesi
//   { aksi: "reset_kirim", akun }                               → kode atur ulang kata sandi (pengguna)
//   { aksi: "reset_cek", tantangan, kode, sandi }               → sandi baru; sesi, atau tahap totp kalau pakai Authenticator
// Dengan sesi (Authorization: Bearer):
//   { aksi: "totp_mulai" } → { tantangan, qr, rahasia }   { aksi: "totp_aktifkan", tantangan, kode }
//   { aksi: "totp_matikan", kode }                          { aksi: "ganti_sandi", sandi_lama, sandi_baru }
import { createClient } from "npm:@supabase/supabase-js@2";
import QRCode from "npm:qrcode@1.5.4";
import { adminDb, CORS, env, esc, json, kunciPublik } from "./_shared/umum.ts";
import { bungkusEmail, kirimEmail } from "./_shared/surel.ts";

const MAKS_GAGAL = 5;            // salah password per akun per 15 menit
const MAKS_KODE = 5;             // salah kode per tantangan
const JEDA_KIRIM = 60_000;
const UMUR_KODE = 10 * 60_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

class Galat extends Error { constructor(m: string, public status = 400, public kode = "") { super(m); } }

// ---------------------------------------------------------------- util
const enc = new TextEncoder();
async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function acak(n: number): Uint8Array<ArrayBuffer> { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; }
function tokenBaru(): string { return btoa(String.fromCharCode(...acak(32))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function kode6(): string { return String(new DataView(acak(4).buffer).getUint32(0) % 1_000_000).padStart(6, "0"); }
function samarkan(email: string): string {
  const [u, dom] = String(email).split("@");
  return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "***") + "@" + dom;
}
function normalHp(p: string): string {
  const d = p.replace(/[^0-9]/g, "");
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return "62" + d.slice(1);
  if (d.startsWith("8")) return "62" + d;
  return d;
}
function cekSandiBaru(s: string) {
  if (s.length < 8) throw new Galat("Kata sandi minimal 8 karakter");
  if (s.length > 72) throw new Galat("Kata sandi maksimal 72 karakter");
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) throw new Galat("Kata sandi harus ada huruf dan angka");
}
function bersihKode(k: unknown): string {
  const t = String(k ?? "").replace(/\D/g, "");
  if (t.length !== 6) throw new Galat("Kodenya 6 angka");
  return t;
}
function klaim(token: string): Record<string, unknown> {
  try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return {}; }
}

// ---------------------------------------------------------------- TOTP (RFC 6238, SHA-1, 30 detik, 6 angka)
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32enc(b: Uint8Array): string {
  let bits = 0, val = 0, out = "";
  for (const x of b) { val = (val << 8) | x; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function b32dec(s: string): Uint8Array<ArrayBuffer> {
  const c = s.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0, val = 0; const out: number[] = [];
  for (const ch of c) { const i = B32.indexOf(ch); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
async function hotp(rahasia: string, langkah: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", b32dec(rahasia), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new ArrayBuffer(8); const dv = new DataView(msg);
  dv.setUint32(0, Math.floor(langkah / 2 ** 32)); dv.setUint32(4, langkah >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[19] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}
/** Langkah yang cocok (toleransi ±30 detik), atau null. Langkah <= terakhir ditolak supaya kode tidak dipakai ulang. */
async function cocokTotp(rahasia: string, kode: string, terakhir: number | null): Promise<number | null> {
  const t = Math.floor(Date.now() / 30_000);
  for (const d of [0, -1, 1]) {
    const l = t + d;
    if (terakhir != null && l <= terakhir) continue;
    if (await hotp(rahasia, l) === kode) return l;
  }
  return null;
}
async function qrTotp(email: string, rahasia: string): Promise<string> {
  const url = `otpauth://totp/${encodeURIComponent("Nawasena:" + email)}?secret=${rahasia}&issuer=Nawasena&algorithm=SHA1&digits=6&period=30`;
  return await QRCode.toString(url, { type: "svg", margin: 1, width: 200, color: { dark: "#0F172A", light: "#FFFFFF" } });
}

// ---------------------------------------------------------------- data
const db = adminDb();
type Tantangan = { id: string; jenis: string; peran: string; user_id: string | null; email: string | null; tahap: string;
  kode_hash: string | null; kode_dikirim: string | null; percobaan: number; totp_baru: string | null; kedaluwarsa: string };

async function ambilTantangan(token: unknown): Promise<Tantangan> {
  const t = String(token || "");
  if (!t) throw new Galat("Langkah login tidak dikenal. Mulai lagi dari awal ya.", 400, "ULANG");
  const { data } = await db.from("tantangan_login").select("*").eq("token_hash", await sha256(t)).maybeSingle();
  if (!data || new Date(data.kedaluwarsa).getTime() < Date.now() || data.tahap === "selesai") {
    throw new Galat("Waktu verifikasi habis. Mulai lagi dari awal ya.", 400, "ULANG");
  }
  if (data.percobaan >= MAKS_KODE) throw new Galat("Terlalu banyak kode salah. Mulai lagi dari awal ya.", 429, "ULANG");
  return data as Tantangan;
}
async function buatTantangan(isi: Partial<Tantangan>): Promise<{ token: string; t: Tantangan }> {
  const token = tokenBaru();
  const { data, error } = await db.from("tantangan_login").insert({ ...isi, token_hash: await sha256(token) }).select("*").single();
  if (error) throw new Error(error.message);
  return { token, t: data as Tantangan };
}
const ubahTantangan = (id: string, isi: Record<string, unknown>) => db.from("tantangan_login").update(isi).eq("id", id);

async function catatPercobaan(kunci: string, berhasil: boolean) { await db.from("percobaan_login").insert({ kunci, berhasil }); }
async function cekKunci(kunci: string) {
  const sejak = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await db.from("percobaan_login").select("id", { count: "exact", head: true })
    .eq("kunci", kunci).eq("berhasil", false).gte("waktu", sejak);
  if ((count || 0) >= MAKS_GAGAL) throw new Galat("Terlalu banyak percobaan gagal. Coba lagi 15 menit lagi.", 429);
}
async function metodeDari(uid: string) {
  const { data } = await db.from("metode_2fa").select("*").eq("user_id", uid).maybeSingle();
  return data as { metode: string; totp_rahasia: string | null; totp_langkah: number | null } | null;
}

const JUDUL: Record<string, string> = { login: "Kode masuk", daftar: "Kode daftar", reset: "Kode atur ulang kata sandi" };
async function kirimKode(t: Tantangan, email: string) {
  if (t.kode_dikirim && Date.now() - new Date(t.kode_dikirim).getTime() < JEDA_KIRIM) {
    throw new Galat("Tunggu sebentar sebelum minta kode lagi ya.", 429);
  }
  const kode = kode6();
  await ubahTantangan(t.id, { kode_hash: await sha256(t.id + ":" + kode), kode_dikirim: new Date().toISOString(), percobaan: 0 });
  const judul = `${JUDUL[t.jenis] || "Kode verifikasi"} Nawasena: ${kode}`;
  const ok = await kirimEmail(email, judul, bungkusEmail(
    `<p>Kode verifikasi kamu:</p><p style="font-size:30px;font-weight:bold;letter-spacing:6px;color:#0284C7;margin:8px 0">${esc(kode)}</p>` +
    `<p>Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun, termasuk yang mengaku dari Nawasena.</p>` +
    `<p style="color:#64748B;font-size:13px">Kalau kamu tidak sedang ${t.jenis === "daftar" ? "mendaftar" : t.jenis === "reset" ? "mengatur ulang kata sandi" : "masuk"}, abaikan email ini dan segera ganti kata sandimu.</p>`));
  if (!ok) throw new Galat("Email kode belum bisa dikirim. Coba lagi beberapa saat lagi.", 502);
}
async function cocokKode(t: Tantangan, kode: string): Promise<boolean> {
  if (!t.kode_hash || !t.kode_dikirim || Date.now() - new Date(t.kode_dikirim).getTime() > UMUR_KODE) {
    throw new Galat("Kodenya sudah kedaluwarsa. Minta kode baru ya.");
  }
  const ok = t.kode_hash === await sha256(t.id + ":" + kode);
  if (!ok) await ubahTantangan(t.id, { percobaan: t.percobaan + 1 });
  return ok;
}

/** Terbitkan sesi Supabase setelah semua langkah lolos. */
async function buatSesi(uid: string, email: string, t?: Tantangan) {
  await db.from("izin_login").upsert({ user_id: uid, berlaku: new Date(Date.now() + 120_000).toISOString() });
  const { data: l, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !l?.properties?.hashed_token) throw new Error("Sesi gagal dibuat: " + (error?.message || "tanpa token"));
  const anon = createClient(env("SUPABASE_URL"), kunciPublik(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: v, error: e2 } = await anon.auth.verifyOtp({ token_hash: l.properties.hashed_token, type: "magiclink" });
  if (e2 || !v.session) throw new Error("Sesi gagal dibuat: " + (e2?.message || "tanpa sesi"));
  const sid = String(klaim(v.session.access_token).session_id || "");
  if (sid) await db.from("sesi_2fa").upsert({ session_id: sid, user_id: uid });
  await db.from("izin_login").delete().eq("user_id", uid);
  if (t) await ubahTantangan(t.id, { tahap: "selesai" });
  await catatPercobaan(uid, true);
  return { access_token: v.session.access_token, refresh_token: v.session.refresh_token };
}

// cari akun dari email/HP
async function cariAkun(peran: string, akun: string) {
  const a = akun.trim();
  if (!a) throw new Galat(peran === "admin" ? "Isi email dulu" : "Isi email atau nomor HP dulu");
  if (peran === "admin") {
    const { data } = await db.from("admin").select("user_id, email, aktif, berlaku_sampai").eq("email", a.toLowerCase()).maybeSingle();
    if (!data) throw new Galat("Email atau kata sandi salah.", 400);
    if (!data.aktif) throw new Galat("Akun ini sedang dinonaktifkan. Hubungi Super admin.", 403);
    if (data.berlaku_sampai && new Date(data.berlaku_sampai).getTime() <= Date.now()) throw new Galat("Masa berlaku akun ini sudah habis. Minta Super admin memperpanjang.", 403);
    return { id: data.user_id as string, email: data.email as string };
  }
  const q = a.includes("@") ? db.from("profil").select("id, email").eq("email", a.toLowerCase()) : db.from("profil").select("id, email").eq("hp", normalHp(a));
  const { data } = await q.maybeSingle();
  if (!data) throw new Galat("Email atau nomor ini belum terdaftar. Coba daftar dulu ya.", 404);
  return { id: data.id as string, email: data.email as string };
}

/** Sesudah password (atau kode reset) lolos: tentukan langkah kedua. */
async function langkahKedua(peran: string, user: { id: string; email: string }, jenis = "login") {
  const m = await metodeDari(user.id);
  if (m?.metode === "totp") {
    const { token } = await buatTantangan({ jenis, peran, user_id: user.id, email: user.email, tahap: "totp" });
    return { tantangan: token, tahap: "totp" };
  }
  if (!m && peran === "admin") {
    const { token } = await buatTantangan({ jenis, peran, user_id: user.id, email: user.email, tahap: "pilih" });
    return { tantangan: token, tahap: "pilih", tujuan: samarkan(user.email) };
  }
  const { token, t } = await buatTantangan({ jenis, peran, user_id: user.id, email: user.email, tahap: "email" });
  await kirimKode(t, user.email);
  return { tantangan: token, tahap: "email", tujuan: samarkan(user.email) };
}

// pengguna yang sedang login (untuk pengaturan keamanan)
async function penggunaSesi(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Galat("Sesi habis, silakan masuk lagi", 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw new Galat("Sesi habis, silakan masuk lagi", 401);
  const sid = String(klaim(token).session_id || "");
  const { data: s } = await db.from("sesi_2fa").select("session_id").eq("session_id", sid).maybeSingle();
  if (!s) throw new Galat("Untuk mengubah keamanan akun, keluar lalu masuk lagi dengan kata sandi dan kode verifikasi.", 401);
  return { id: data.user.id, email: data.user.email || "", sid };
}

// ---------------------------------------------------------------- handler
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    const aksi = String(b.aksi || "");
    const peran = b.peran === "admin" ? "admin" : "pengguna";

    if (aksi === "sandi") {
      const kunci = peran + ":" + String(b.akun || "").trim().toLowerCase();
      await cekKunci(kunci);
      const user = await cariAkun(peran, String(b.akun || ""));
      await cekKunci(user.id);
      const sandi = String(b.sandi || "");
      if (!sandi) throw new Galat("Isi kata sandinya dulu ya");
      const { data: cocok } = await db.rpc("cek_sandi", { p_user: user.id, p_sandi: sandi });
      if (!cocok) {
        await catatPercobaan(kunci, false); await catatPercobaan(user.id, false);
        if (peran === "pengguna") {
          const { data: ada } = await db.rpc("punya_sandi", { p_user: user.id });
          if (!ada) throw new Galat("Akun ini belum punya kata sandi. Pakai \"Lupa / belum punya kata sandi?\" untuk membuatnya.", 400, "BELUM_ADA_SANDI");
        }
        throw new Galat(peran === "admin" ? "Email atau kata sandi salah." : "Kata sandinya belum cocok. Coba lagi, atau pakai \"Lupa kata sandi?\".");
      }
      return json(await langkahKedua(peran, user));
    }

    if (aksi === "pilih") {
      const t = await ambilTantangan(b.tantangan);
      if (t.tahap !== "pilih") throw new Galat("Langkah ini sudah lewat. Mulai lagi ya.", 400, "ULANG");
      if (b.metode === "totp") {
        const rahasia = b32enc(acak(20));
        await ubahTantangan(t.id, { tahap: "totp_baru", totp_baru: rahasia });
        return json({ tahap: "totp_baru", qr: await qrTotp(t.email || "", rahasia), rahasia });
      }
      await ubahTantangan(t.id, { tahap: "email_baru" });
      await kirimKode({ ...t, tahap: "email_baru" }, t.email || "");
      return json({ tahap: "email_baru", tujuan: samarkan(t.email || "") });
    }

    if (aksi === "kirim_ulang") {
      const t = await ambilTantangan(b.tantangan);
      if (!["email", "email_baru"].includes(t.tahap) && !(t.jenis !== "login" && t.tahap === "kode")) throw new Galat("Langkah ini tidak memakai kode email.");
      await kirimKode(t, t.email || "");
      return json({ ok: true, tujuan: samarkan(t.email || "") });
    }

    if (aksi === "verifikasi") {
      const t = await ambilTantangan(b.tantangan);
      const kode = bersihKode(b.kode);
      if (!t.user_id || !t.email) throw new Galat("Langkah login tidak dikenal. Mulai lagi ya.", 400, "ULANG");
      if (t.tahap === "email" || t.tahap === "email_baru") {
        if (!(await cocokKode(t, kode))) throw new Galat("Kodenya salah. Cek lagi email terbaru dari Nawasena.");
        if (t.tahap === "email_baru") await db.from("metode_2fa").upsert({ user_id: t.user_id, metode: "email", totp_rahasia: null, totp_langkah: null, diubah: new Date().toISOString() });
      } else if (t.tahap === "totp") {
        const m = await metodeDari(t.user_id);
        if (!m?.totp_rahasia) throw new Galat("Authenticator belum diatur untuk akun ini.", 400, "ULANG");
        const l = await cocokTotp(m.totp_rahasia, kode, m.totp_langkah);
        if (l == null) { await ubahTantangan(t.id, { percobaan: t.percobaan + 1 }); throw new Galat("Kode Authenticator salah atau sudah dipakai. Tunggu kode berikutnya lalu coba lagi."); }
        await db.from("metode_2fa").update({ totp_langkah: l }).eq("user_id", t.user_id);
      } else if (t.tahap === "totp_baru") {
        const l = await cocokTotp(t.totp_baru || "", kode, null);
        if (l == null) { await ubahTantangan(t.id, { percobaan: t.percobaan + 1 }); throw new Galat("Kodenya belum cocok. Pastikan jam di HP sudah otomatis, lalu masukkan kode yang sedang tampil."); }
        await db.from("metode_2fa").upsert({ user_id: t.user_id, metode: "totp", totp_rahasia: t.totp_baru, totp_langkah: l, diubah: new Date().toISOString() });
      } else {
        throw new Galat("Langkah ini sudah lewat. Mulai lagi ya.", 400, "ULANG");
      }
      if (t.peran === "admin") {
        // cek ulang status akun tepat sebelum sesi diberikan
        await cariAkun("admin", t.email);
        await db.from("admin").update({ masuk_terakhir: new Date().toISOString() }).eq("user_id", t.user_id);
      }
      return json(await buatSesi(t.user_id, t.email, t));
    }

    if (aksi === "daftar_kirim") {
      const email = String(b.email || "").trim().toLowerCase();
      if (!EMAIL.test(email)) throw new Galat("Email belum benar");
      const { data: ada } = await db.rpc("cari_user_email", { p_email: email });
      if (ada) throw new Galat("Email ini sudah terdaftar. Pakai Login ya.", 409);
      await cekKunci("daftar:" + email);
      const { token, t } = await buatTantangan({ jenis: "daftar", email, tahap: "kode" });
      await kirimKode(t, email);
      return json({ tantangan: token, tahap: "kode", tujuan: email });
    }

    if (aksi === "daftar_cek") {
      const t = await ambilTantangan(b.tantangan);
      if (t.jenis !== "daftar" || t.tahap !== "kode" || !t.email) throw new Galat("Langkah daftar tidak dikenal. Mulai lagi ya.", 400, "ULANG");
      const kode = bersihKode(b.kode);
      const sandi = String(b.sandi || "");
      cekSandiBaru(sandi);
      if (!(await cocokKode(t, kode))) throw new Galat("Kodenya salah. Cek lagi email terbaru dari Nawasena.");
      const { data, error } = await db.auth.admin.createUser({ email: t.email, password: sandi, email_confirm: true });
      if (error || !data?.user) {
        const m = String(error?.message || "");
        throw new Galat(/already|registered|exists/i.test(m) ? "Email ini sudah terdaftar. Pakai Login ya." : "Akun gagal dibuat: " + m, 409);
      }
      return json({ ...(await buatSesi(data.user.id, t.email, t)), user_id: data.user.id });
    }

    if (aksi === "reset_kirim") {
      const user = await cariAkun("pengguna", String(b.akun || ""));
      await cekKunci("reset:" + user.id);
      const { token, t } = await buatTantangan({ jenis: "reset", user_id: user.id, email: user.email, tahap: "kode" });
      await kirimKode(t, user.email);
      await catatPercobaan("reset:" + user.id, false);   // dihitung supaya kode reset tidak bisa diminta terus-menerus
      return json({ tantangan: token, tahap: "kode", tujuan: samarkan(user.email) });
    }

    if (aksi === "reset_cek") {
      const t = await ambilTantangan(b.tantangan);
      if (t.jenis !== "reset" || t.tahap !== "kode" || !t.user_id || !t.email) throw new Galat("Langkah ini tidak dikenal. Mulai lagi ya.", 400, "ULANG");
      const kode = bersihKode(b.kode);
      const sandi = String(b.sandi || "");
      cekSandiBaru(sandi);
      if (!(await cocokKode(t, kode))) throw new Galat("Kodenya salah. Cek lagi email terbaru dari Nawasena.");
      const { error } = await db.auth.admin.updateUserById(t.user_id, { password: sandi });
      if (error) throw new Galat("Kata sandi gagal disimpan: " + error.message);
      await db.from("sesi_2fa").delete().eq("user_id", t.user_id);   // sesi lain di perangkat lain tidak bisa diperpanjang
      await db.rpc("putus_sesi", { p_user: t.user_id });
      const m = await metodeDari(t.user_id);
      if (m?.metode === "totp") {
        await ubahTantangan(t.id, { tahap: "selesai" });
        const { token } = await buatTantangan({ jenis: "login", peran: "pengguna", user_id: t.user_id, email: t.email, tahap: "totp" });
        return json({ tantangan: token, tahap: "totp" });
      }
      return json(await buatSesi(t.user_id, t.email, t));   // kode email sudah jadi langkah kedua
    }

    // ------------------------------------------------ butuh sesi yang sudah lolos dua langkah
    if (aksi === "totp_mulai") {
      const u = await penggunaSesi(req);
      const rahasia = b32enc(acak(20));
      const { token } = await buatTantangan({ jenis: "atur_totp", user_id: u.id, email: u.email, tahap: "totp_baru", totp_baru: rahasia });
      return json({ tantangan: token, qr: await qrTotp(u.email, rahasia), rahasia });
    }
    if (aksi === "totp_aktifkan") {
      const u = await penggunaSesi(req);
      const t = await ambilTantangan(b.tantangan);
      if (t.jenis !== "atur_totp" || t.user_id !== u.id || !t.totp_baru) throw new Galat("Mulai lagi pengaturan Authenticator ya.", 400, "ULANG");
      const l = await cocokTotp(t.totp_baru, bersihKode(b.kode), null);
      if (l == null) { await ubahTantangan(t.id, { percobaan: t.percobaan + 1 }); throw new Galat("Kodenya belum cocok. Pastikan jam di HP sudah otomatis, lalu masukkan kode yang sedang tampil."); }
      await db.from("metode_2fa").upsert({ user_id: u.id, metode: "totp", totp_rahasia: t.totp_baru, totp_langkah: l, diubah: new Date().toISOString() });
      await ubahTantangan(t.id, { tahap: "selesai" });
      return json({ ok: true, metode: "totp" });
    }
    if (aksi === "totp_matikan") {
      const u = await penggunaSesi(req);
      const m = await metodeDari(u.id);
      if (m?.metode !== "totp" || !m.totp_rahasia) return json({ ok: true, metode: "email" });
      const l = await cocokTotp(m.totp_rahasia, bersihKode(b.kode), m.totp_langkah);
      if (l == null) throw new Galat("Kode Authenticator salah atau sudah dipakai.");
      await db.from("metode_2fa").upsert({ user_id: u.id, metode: "email", totp_rahasia: null, totp_langkah: null, diubah: new Date().toISOString() });
      return json({ ok: true, metode: "email" });
    }
    if (aksi === "ganti_sandi") {
      const u = await penggunaSesi(req);
      await cekKunci(u.id);
      const { data: cocok } = await db.rpc("cek_sandi", { p_user: u.id, p_sandi: String(b.sandi_lama || "") });
      if (!cocok) { await catatPercobaan(u.id, false); throw new Galat("Kata sandi lama belum cocok."); }
      const baru = String(b.sandi_baru || "");
      cekSandiBaru(baru);
      const { error } = await db.auth.admin.updateUserById(u.id, { password: baru });
      if (error) throw new Galat("Kata sandi gagal disimpan: " + error.message);
      await db.from("sesi_2fa").delete().eq("user_id", u.id).neq("session_id", u.sid);   // perangkat lain tidak bisa memperpanjang sesi
      return json({ ok: true });
    }

    return json({ galat: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    if (e instanceof Galat) return json({ galat: e.message, kode: e.kode || undefined }, e.status);
    console.error(e);
    return json({ galat: "Ada kendala di server. Coba lagi sebentar lagi." }, 500);
  }
});
