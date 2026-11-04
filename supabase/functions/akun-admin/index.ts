// POST /functions/v1/akun-admin — kelola akun backoffice (RBAC). Dipanggil dari menu "Akun & role".
//   { aksi: "buat",  nama, email, hp, sandi, peran_id }        → izin akun:c  (akun login baru, email langsung aktif)
//   { aksi: "ubah",  user_id, nama?, hp?, peran_id?, aktif? }  → izin akun:u  (nonaktif = semua sesinya diputus)
//   { aksi: "sandi", user_id, sandi }                          → izin akun:u  (reset kata sandi + putus sesi)
//   { aksi: "hapus", user_id }                                 → izin akun:d  (hapus akses backoffice + blokir login)
// Aturan: tidak bisa menonaktifkan/menurunkan/menghapus akun sendiri, dan minimal satu Super admin aktif tetap ada.
// Semua aksi tercatat di audit_log.
import { adminDb, CORS, json, penggunaDari } from "./_shared/umum.ts";
import { punyaIzin } from "./_shared/izin.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PERLU: Record<string, "c" | "u" | "d"> = { buat: "c", ubah: "u", sandi: "u", hapus: "d" };

function cekSandi(s: string) {
  if (s.length < 8) throw new Error("Kata sandi minimal 8 karakter");
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) throw new Error("Kata sandi harus ada huruf dan angka");
}
function bersihHp(h: unknown): string | null {
  const d = String(h ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length < 9 || d.length > 15) throw new Error("Nomor telepon belum benar");
  return d.startsWith("0") ? "62" + d.slice(1) : d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const saya = await penggunaDari(req);
    if (!saya) return json({ galat: "Sesi habis, silakan masuk lagi" }, 401);
    const body = await req.json().catch(() => ({}));
    const aksi = String(body.aksi || "");
    const perlu = PERLU[aksi];
    if (!perlu) return json({ galat: "Aksi tidak dikenal" }, 400);
    if (!(await punyaIzin(req, "akun", perlu))) return json({ galat: "Kamu tidak punya izin mengelola akun, atau sesimu sudah lewat 24 jam" }, 403);

    const db = adminDb();
    const audit = (a: string, id: string, ringkas: string, sebelum: unknown = null, sesudah: unknown = null) =>
      db.rpc("tulis_audit", { p_admin: saya.id, p_menu: "akun", p_aksi: a, p_objek: "admin", p_objek_id: id, p_ringkas: ringkas, p_sebelum: sebelum, p_sesudah: sesudah });
    const { data: peranSemua } = await db.from("peran").select("id, nama, sistem");
    const namaPeran = (id: string | null) => (peranSemua || []).find((p) => p.id === id)?.nama || "-";
    const idSuper = (peranSemua || []).find((p) => p.sistem)?.id;
    const superLain = async (kecuali: string) => {
      const { count } = await db.from("admin").select("user_id", { count: "exact", head: true })
        .eq("peran_id", idSuper).eq("aktif", true).neq("user_id", kecuali);
      return count || 0;
    };

    if (aksi === "buat") {
      const nama = String(body.nama || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const sandi = String(body.sandi || "");
      const peran = String(body.peran_id || "");
      if (!nama) return json({ galat: "Nama wajib diisi" }, 400);
      if (!EMAIL.test(email)) return json({ galat: "Email belum benar" }, 400);
      if (!(peranSemua || []).some((p) => p.id === peran)) return json({ galat: "Pilih role akunnya" }, 400);
      cekSandi(sandi);
      const hp = bersihHp(body.hp);
      const { data, error } = await db.auth.admin.createUser({ email, password: sandi, email_confirm: true, user_metadata: { nama, backoffice: true } });
      if (error || !data?.user) {
        const m = String(error?.message || "");
        return json({ galat: /already|registered|exists/i.test(m) ? "Email ini sudah dipakai akun lain (termasuk akun pengguna aplikasi)" : "Akun gagal dibuat: " + m }, 409);
      }
      const baris = { user_id: data.user.id, nama, email, hp, peran_id: peran, aktif: true };
      const { error: e2 } = await db.from("admin").insert(baris);
      if (e2) { await db.auth.admin.deleteUser(data.user.id); throw new Error("Akun gagal disimpan: " + e2.message); }
      await audit("create", data.user.id, `${nama} <${email}> · ${namaPeran(peran)}`, null, { ...baris, peran: namaPeran(peran) });
      return json({ ok: true, user_id: data.user.id });
    }

    const target = String(body.user_id || "");
    const { data: lama } = await db.from("admin").select("*").eq("user_id", target).maybeSingle();
    if (!lama) return json({ galat: "Akun tidak ditemukan" }, 404);
    const diriSendiri = target === saya.id;

    if (aksi === "ubah") {
      const ubah: Record<string, unknown> = {};
      if (body.nama !== undefined) { const n = String(body.nama).trim(); if (!n) return json({ galat: "Nama wajib diisi" }, 400); ubah.nama = n; }
      if (body.hp !== undefined) ubah.hp = bersihHp(body.hp);
      if (body.peran_id !== undefined) {
        if (!(peranSemua || []).some((p) => p.id === body.peran_id)) return json({ galat: "Role tidak dikenal" }, 400);
        ubah.peran_id = body.peran_id;
      }
      if (body.aktif !== undefined) ubah.aktif = !!body.aktif;
      const turunSuper = lama.peran_id === idSuper && ((ubah.peran_id && ubah.peran_id !== idSuper) || ubah.aktif === false);
      if (diriSendiri && (ubah.aktif === false || turunSuper)) return json({ galat: "Kamu tidak bisa menonaktifkan atau menurunkan role akunmu sendiri" }, 400);
      if (turunSuper && (await superLain(target)) === 0) return json({ galat: "Minimal harus ada satu Super admin yang aktif" }, 400);
      const { error } = await db.from("admin").update(ubah).eq("user_id", target);
      if (error) throw new Error(error.message);
      if (ubah.aktif === false || (ubah.peran_id && ubah.peran_id !== lama.peran_id)) await db.rpc("putus_sesi", { p_user: target });
      const ket = [ubah.peran_id && ubah.peran_id !== lama.peran_id ? `role ${namaPeran(lama.peran_id)} → ${namaPeran(ubah.peran_id as string)}` : "",
        ubah.aktif === false ? "dinonaktifkan" : ubah.aktif === true && !lama.aktif ? "diaktifkan" : ""].filter(Boolean).join(", ");
      await audit("update", target, `${lama.nama || lama.email}${ket ? " · " + ket : ""}`, lama, { ...lama, ...ubah });
      return json({ ok: true });
    }

    if (aksi === "sandi") {
      const sandi = String(body.sandi || "");
      cekSandi(sandi);
      const { error } = await db.auth.admin.updateUserById(target, { password: sandi });
      if (error) throw new Error("Kata sandi gagal diganti: " + error.message);
      if (!diriSendiri) await db.rpc("putus_sesi", { p_user: target });
      await audit("update", target, `${lama.nama || lama.email} · reset kata sandi`);
      return json({ ok: true });
    }

    if (aksi === "hapus") {
      if (diriSendiri) return json({ galat: "Kamu tidak bisa menghapus akunmu sendiri" }, 400);
      if (lama.peran_id === idSuper && lama.aktif && (await superLain(target)) === 0) return json({ galat: "Minimal harus ada satu Super admin yang aktif" }, 400);
      const { error } = await db.from("admin").delete().eq("user_id", target);
      if (error) throw new Error(error.message);
      await db.rpc("putus_sesi", { p_user: target });
      // Hapus akun login. Kalau masih dirujuk data lain (mis. order yang pernah dikonfirmasi), cukup diblokir.
      const { error: e3 } = await db.auth.admin.deleteUser(target);
      if (e3) await db.auth.admin.updateUserById(target, { ban_duration: "876000h" });
      await audit("delete", target, `${lama.nama || lama.email} <${lama.email || ""}>`, lama, null);
      return json({ ok: true });
    }
    return json({ galat: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    console.error(e);
    return json({ galat: String((e as Error).message || e) }, 400);
  }
});
