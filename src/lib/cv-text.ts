// Logika CV builder (aman dipakai di klien maupun server).

export interface BuiltCv {
  diri: { nama: string; kota: string; hp: string; email: string; linkedin: string };
  pendidikan: { gelar: string; kampus: string; kota: string; lulus: string; ipk: string };
  kerja: { posisi: string; tempat: string; mulai: string; selesai: string; bullets: Bullet[] }[];
  org: { peran: string; nama: string; mulai: string; selesai: string; bullets: Bullet[] }[];
  keahlian: string[];
  sertifikasi: { nama: string; penerbit: string; tahun: string }[];
  profil: string;
}
export interface Bullet {
  tugas: string;
  jumlah: string;
  hasil: string;
}

export function emptyBuiltCv(): BuiltCv {
  return {
    diri: { nama: "", kota: "", hp: "", email: "", linkedin: "" },
    pendidikan: { gelar: "", kampus: "", kota: "", lulus: "", ipk: "" },
    kerja: [],
    org: [],
    keahlian: [],
    sertifikasi: [],
    profil: "",
  };
}

// Merangkai satu bullet ATS dari tiga isian sederhana (AC-E3.3).
// tugas → jumlah/durasi → hasil. Kata kerja diawali huruf besar, tanpa titik ganda.
export function composeBullet(b: Bullet): string {
  const t = b.tugas.trim().replace(/\.$/, "");
  const j = b.jumlah.trim().replace(/\.$/, "");
  const h = b.hasil.trim().replace(/\.$/, "");
  if (!t) return "";
  let s = t.charAt(0).toUpperCase() + t.slice(1);
  if (j) s += ` (${j})`;
  if (h) s += `, ${h.charAt(0).toLowerCase() + h.slice(1)}`;
  return s + ".";
}

// Draf profil singkat dari isian langkah 1–6 (AC-E3.6). Pengguna tinggal menyunting.
export function draftProfile(cv: BuiltCv): string {
  const p = cv.pendidikan;
  const parts: string[] = [];
  const lulusan = p.gelar && p.kampus ? `Lulusan ${p.gelar} ${p.kampus}` : p.gelar ? `Lulusan ${p.gelar}` : "Lulusan baru";
  const org = cv.org[0];
  const kerja = cv.kerja[0];
  parts.push(`${lulusan}${p.lulus ? ` (${p.lulus})` : ""}.`);
  if (kerja?.posisi) parts.push(`Berpengalaman sebagai ${kerja.posisi}${kerja.tempat ? ` di ${kerja.tempat}` : ""}.`);
  if (org?.peran) parts.push(`Aktif sebagai ${org.peran}${org.nama ? ` di ${org.nama}` : ""}${org.bullets[0]?.hasil ? `, ${org.bullets[0].hasil.replace(/\.$/, "")}` : ""}.`);
  if (cv.keahlian.length) parts.push(`Terbiasa dengan ${listJoin(cv.keahlian.slice(0, 4))}.`);
  return parts.join(" ");
}

function listJoin(xs: string[]) {
  if (xs.length <= 1) return xs.join("");
  return xs.slice(0, -1).join(", ") + ", dan " + xs[xs.length - 1];
}

// Teks polos dari CV builder: satu kolom, heading standar (AC-E3.7).
export function builtCvToText(cv: BuiltCv): string {
  const L: string[] = [];
  const d = cv.diri;
  L.push(d.nama.toUpperCase());
  L.push([d.kota, d.hp, d.email, d.linkedin].filter(Boolean).join(" | "));
  if (cv.profil) L.push("", "PROFIL", cv.profil);
  const p = cv.pendidikan;
  if (p.gelar || p.kampus) {
    L.push("", "PENDIDIKAN", `${p.gelar}, ${p.kampus}${p.kota ? `, ${p.kota}` : ""}`);
    L.push([p.lulus && `Lulus ${p.lulus}`, p.ipk && `IPK ${p.ipk}/4,00`].filter(Boolean).join(" · "));
  }
  const kerja = cv.kerja.filter((k) => k.posisi.trim());
  const org = cv.org.filter((o) => o.peran.trim());
  const sert = cv.sertifikasi.filter((s) => s.nama.trim());
  if (kerja.length) {
    L.push("", "PENGALAMAN KERJA");
    for (const k of kerja) {
      L.push(`${k.posisi}, ${k.tempat} (${k.mulai} – ${k.selesai || "sekarang"})`);
      k.bullets.map(composeBullet).filter(Boolean).forEach((b) => L.push(`- ${b}`));
    }
  }
  if (org.length) {
    L.push("", "PROYEK DAN ORGANISASI");
    for (const o of org) {
      L.push(`${o.peran}, ${o.nama} (${o.mulai} – ${o.selesai || "sekarang"})`);
      o.bullets.map(composeBullet).filter(Boolean).forEach((b) => L.push(`- ${b}`));
    }
  }
  if (cv.keahlian.length) L.push("", "KEAHLIAN", cv.keahlian.join(", "));
  if (sert.length) {
    L.push("", "SERTIFIKASI DAN PELATIHAN");
    sert.forEach((s) => L.push(`- ${[s.nama, s.penerbit].filter(Boolean).join(", ")}${s.tahun ? ` (${s.tahun})` : ""}`));
  }
  return L.filter((x) => x !== undefined).join("\n").trim();
}
