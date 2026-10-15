// POST /functions/v1/konfirmasi — dipakai backoffice.
//   { pesanan_id, aksi: "ok", nominal_bukti? }            → tandai lunas, mulai susun Bagian 2–6
//   { pesanan_id, aksi: "tolak", alasan, nominal_bukti? } → tolak dengan alasan (pengguna bisa kirim ulang bukti)
//   { pesanan_id, aksi: "batal" }                         → kembalikan ke Menunggu (keputusan sendiri, maks. 15 menit)
// Keputusan lewat fungsi database putuskan_pesanan: keputusan pertama yang tersimpan menang,
// dan setiap keputusan tercatat di audit_admin.
import { adminDb, CORS, esc, json, kirimEmail, penggunaDari, picuFungsi } from "./_shared/umum.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const user = await penggunaDari(req);
    if (!user) return json({ galat: "Sesi habis, silakan masuk lagi" }, 401);
    const db = adminDb();
    const { data: adm } = await db.from("admin").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adm) return json({ galat: "Akun ini bukan admin" }, 403);

    const { pesanan_id, aksi, alasan, nominal_bukti } = await req.json();
    const { data: ps } = await db.from("pesanan").select("*, profil(nama, email)").eq("id", pesanan_id).single();
    if (!ps) return json({ galat: "Pesanan tidak ditemukan" }, 404);
    const app = Deno.env.get("APP_URL") || "";
    const nominal = Number.isFinite(Number(nominal_bukti)) && Number(nominal_bukti) > 0 ? Math.round(Number(nominal_bukti)) : null;

    const putuskan = async (a: string, alasanTolak: string | null = null) => {
      const { data, error } = await db.rpc("putuskan_pesanan", {
        p_pesanan: pesanan_id, p_admin: user.id, p_aksi: a, p_alasan: alasanTolak, p_nominal: nominal,
      });
      if (error) throw new Error(error.message);
      return data && (data as { id?: string }).id ? data : null;
    };

    if (aksi === "ok") {
      // Sudah lunas: cukup picu ulang penyusunan laporan (berguna kalau laporan macet).
      if (ps.status === "ok") {
        await picuFungsi("laporan-lengkap", { user_id: ps.user_id });
        return json({ ok: true });
      }
      if (!(await putuskan("ok"))) {
        return json({ galat: "Pesanan ini sudah diputuskan admin lain. Muat ulang untuk melihat status terbaru." }, 409);
      }
      await picuFungsi("laporan-lengkap", { user_id: ps.user_id });
      await kirimEmail(ps.profil.email, "Pembayaranmu sudah dikonfirmasi",
        `<p>Halo ${esc(ps.profil.nama)},</p><p>Pembayaran ${esc(ps.kode)} sudah kami terima. Keenam bagian peta potensimu sedang disusun dan biasanya siap dalam beberapa menit.</p>` +
        (app ? `<p><a href="${app}">Buka peta potensimu</a></p>` : "") + `<p>— Nawasena</p>`);
      return json({ ok: true });
    }

    if (aksi === "tolak") {
      const a = String(alasan || "").trim();
      if (!a) return json({ galat: "Alasan penolakan wajib diisi" }, 400);
      if (!(await putuskan("tolak", a))) {
        return json({ galat: "Pesanan ini sudah diputuskan admin lain. Muat ulang untuk melihat status terbaru." }, 409);
      }
      await kirimEmail(ps.profil.email, "Bukti pembayaranmu perlu dikirim ulang",
        `<p>Halo ${esc(ps.profil.nama)},</p><p>Bukti pembayaran ${esc(ps.kode)} belum bisa kami konfirmasi: ${esc(a)}</p>` +
        `<p>Kamu bisa kirim ulang buktinya dari halaman pembayaran.</p>` + (app ? `<p><a href="${app}">Buka Nawasena</a></p>` : "") + `<p>— Nawasena</p>`);
      return json({ ok: true });
    }

    if (aksi === "batal") {
      if (!(await putuskan("batal"))) {
        return json({ galat: "Keputusan ini sudah tidak bisa dibatalkan: lewat 15 menit, atau bukan keputusanmu." }, 409);
      }
      return json({ ok: true });
    }
    return json({ galat: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    console.error(e);
    return json({ galat: String((e as Error).message || e) }, 500);
  }
});
