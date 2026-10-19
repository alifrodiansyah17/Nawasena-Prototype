// Penilaian kuis 36 butir: 12 hal × 3 butir, skala 1–4 (Bukan aku · Kurang · Lumayan · Aku banget).
// Urutan butir sama persis dengan aplikasi (web/public/aset/data.js → ITEMS).

export const HAL = [
  { k: "R", grup: "minat", lab: "Mengerjakan hal praktis dengan tangan" },
  { k: "I", grup: "minat", lab: "Mengulik sebab dan pola di balik sesuatu" },
  { k: "A", grup: "minat", lab: "Peka pada hal yang rapi dan enak dilihat" },
  { k: "S", grup: "minat", lab: "Tertarik pada orang dan ceritanya" },
  { k: "E", grup: "minat", lab: "Mengambil alih dan memutuskan" },
  { k: "C", grup: "minat", lab: "Nyaman dengan aturan dan keteraturan" },
  { k: "O", grup: "cara", lab: "Terbuka pada cara dan hal baru" },
  { k: "Cs", grup: "cara", lab: "Tekun dan konsisten sampai tuntas" },
  { k: "Ex", grup: "cara", lab: "Dapat energi dari bertemu orang" },
  { k: "Ag", grup: "cara", lab: "Mengalah demi menjaga suasana" },
  { k: "St", grup: "cara", lab: "Tetap tenang saat ditekan" },
  { k: "To", grup: "cara", lab: "Tahan menghadapi hal yang belum jelas" },
] as const;

export function band(v: number): string {
  // rentang 3–12
  return v >= 11 ? "Kuat banget" : v >= 9 ? "Kuat" : v >= 7 ? "Cukup" : "Perlu dilatih";
}

export interface Skor {
  nilai: Record<string, number>;
  urut_minat: string[];
  urut_cara: string[];
  pola: {
    titik_dipakai: number;     // berapa titik skala yang dipakai (1–4)
    ujung: number;             // berapa kali jawab 1 atau 4
    sebaran: number;           // selisih nilai tertinggi dan terendah
    datar: boolean;            // profil terlalu seragam untuk diurutkan dengan yakin
    catatan: string;
  };
  bar_minat: { lab: string; band: string; persen: number }[];
  bar_cara: { lab: string; band: string; persen: number }[];
}

export function hitungSkor(jawab: (number | null)[]): Skor {
  if (!Array.isArray(jawab) || jawab.length < 36 || jawab.slice(0, 36).some((x) => !(x! >= 1 && x! <= 4))) {
    throw new Error("Jawaban kuis belum lengkap");
  }
  const a = jawab.slice(0, 36).map(Number);
  const nilai: Record<string, number> = {};
  HAL.forEach((h, i) => (nilai[h.k] = a[i * 3] + a[i * 3 + 1] + a[i * 3 + 2]));
  const urut = (g: string) =>
    HAL.filter((h) => h.grup === g).map((h) => h.k).sort((x, y) => nilai[y] - nilai[x]);
  const titik = new Set(a).size;
  const ujung = a.filter((x) => x === 1 || x === 4).length;
  const vs = Object.values(nilai);
  const sebaran = Math.max(...vs) - Math.min(...vs);
  const datar = sebaran <= 2 || titik <= 2;
  const catatan = datar
    ? `Profil jawaban cukup seragam (memakai ${titik} titik skala, sebaran ${sebaran}). Jangan mengurutkan minat terlalu yakin; ambil pembeda dari CV dan dari hal yang dijawab berlawanan arus.`
    : `Memakai ${titik} titik skala dan ${ujung} kali menjawab di ujung skala, jadi polanya cukup bisa dipegang.`;
  const bar = (g: string) =>
    urut(g).map((k) => ({
      lab: HAL.find((h) => h.k === k)!.lab,
      band: band(nilai[k]),
      persen: Math.round((nilai[k] / 12) * 1000) / 10,
    }));
  return {
    nilai,
    urut_minat: urut("minat"),
    urut_cara: urut("cara"),
    pola: { titik_dipakai: titik, ujung, sebaran, datar, catatan },
    bar_minat: bar("minat"),
    bar_cara: bar("cara"),
  };
}

/** Ringkasan teks untuk prompt AI: nilai per hal + jawaban per butir. */
export function ringkasUntukAI(jawab: number[], skor: Skor, items: string[]): string {
  const baris = HAL.map((h, i) => {
    const b = [0, 1, 2].map((j) => `   - "${items[i * 3 + j]}" → ${jawab[i * 3 + j]}/4`).join("\n");
    // tanpa kode singkat (E, Cs, To, …) supaya kode internal tidak ikut tertulis di laporan
    return `${h.lab}: ${skor.nilai[h.k]}/12 (${band(skor.nilai[h.k])})\n${b}`;
  });
  return baris.join("\n") + `\n\nPola menjawab: ${skor.pola.catatan}`;
}
