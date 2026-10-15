// Instrumen 36 item (§6.2). 12 konstruk × 3 item, Likert 4 titik tanpa titik tengah.
// Catatan: kalimat item masih draf dari prototipe dan belum tervalidasi (R1).

export const CONSTRUCTS = [
  { kode: "R", nama: "Mengerjakan hal praktis dengan tangan", grup: "minat" },
  { kode: "I", nama: "Mengulik sebab dan pola di balik sesuatu", grup: "minat" },
  { kode: "A", nama: "Peka pada hal yang rapi dan enak dilihat", grup: "minat" },
  { kode: "S", nama: "Tertarik pada orang dan perkembangannya", grup: "minat" },
  { kode: "E", nama: "Mengambil alih dan memutuskan", grup: "minat" },
  { kode: "C", nama: "Nyaman dengan aturan dan keteraturan", grup: "minat" },
  { kode: "O", nama: "Terbuka pada cara dan hal baru", grup: "cara" },
  { kode: "Cs", nama: "Tekun dan konsisten sampai tuntas", grup: "cara" },
  { kode: "Ex", nama: "Dapat energi dari bertemu orang", grup: "cara" },
  { kode: "Ag", nama: "Mengalah demi menjaga suasana", grup: "cara" },
  { kode: "St", nama: "Tetap tenang saat ditekan", grup: "cara" },
  { kode: "Am", nama: "Tahan menghadapi hal yang belum jelas", grup: "cara" },
] as const;
export type ConstructCode = (typeof CONSTRUCTS)[number]["kode"];

export const ITEMS: { teks: string; konstruk: ConstructCode }[] = [
  { teks: "Aku lebih cepat paham kalau langsung praktik daripada baca teorinya dulu.", konstruk: "R" },
  { teks: "Aku suka mengutak-atik barang buat tahu cara kerjanya.", konstruk: "R" },
  { teks: "Aku lebih puas kalau hasil kerjaku kelihatan bentuknya.", konstruk: "R" },
  { teks: "Kalau ada yang tidak masuk akal, aku penasaran terus sampai ketemu jawabannya.", konstruk: "I" },
  { teks: "Aku betah menelusuri data sampai ketemu polanya.", konstruk: "I" },
  { teks: "Pertanyaan kenapa bisa gitu sering terbawa sampai mau tidur.", konstruk: "I" },
  { teks: "Aku sering memikirkan cara bikin sesuatu jadi lebih enak dilihat.", konstruk: "A" },
  { teks: "Aku nyaman mengerjakan sesuatu yang belum ada contohnya.", konstruk: "A" },
  { teks: "Nulis, gambar, atau bikin konten itu hiburan buat aku, bukan beban.", konstruk: "A" },
  { teks: "Aku senang kalau ada yang bertanya terus aku bisa menjelaskan.", konstruk: "S" },
  { teks: "Melihat orang lain berkembang bikin aku ikut senang.", konstruk: "S" },
  { teks: "Aku gampang sadar kalau ada teman yang lagi badmood.", konstruk: "S" },
  { teks: "Aku tidak masalah jadi orang yang mengajak duluan.", konstruk: "E" },
  { teks: "Aku suka suasana yang ada targetnya dan ada yang dikejar.", konstruk: "E" },
  { teks: "Mengajak orang ikut ideku itu seru, bukan bikin capek.", konstruk: "E" },
  { teks: "Aku lebih tenang kalau kerjaannya ada urutan yang jelas.", konstruk: "C" },
  { teks: "Aku suka merapikan file dan catatan biar gampang dicari.", konstruk: "C" },
  { teks: "Aturan main yang jelas bikin aku kerja lebih enak.", konstruk: "C" },
  { teks: "Aku gampang tertarik sama hal yang benar-benar baru.", konstruk: "O" },
  { teks: "Aku suka membahas ide yang masih mengambang.", konstruk: "O" },
  { teks: "Mencoba cara baru lebih seru daripada pakai cara yang sudah aman.", konstruk: "O" },
  { teks: "Kalau sudah bilang selesai hari ini, biasanya benar-benar selesai.", konstruk: "Cs" },
  { teks: "Aku biasanya mengecek ulang kerjaan sebelum dikirim.", konstruk: "Cs" },
  { teks: "Aku jarang menunda hal yang sudah jelas mau dikerjakan.", konstruk: "Cs" },
  { teks: "Ketemu banyak orang bikin aku lebih berenergi.", konstruk: "Ex" },
  { teks: "Aku santai saja bicara duluan di ruangan yang isinya orang baru.", konstruk: "Ex" },
  { teks: "Aku lebih memilih kerja bareng daripada sendirian.", konstruk: "Ex" },
  { teks: "Aku sering mengalah biar suasananya tetap enak.", konstruk: "Ag" },
  { teks: "Aku gampang percaya sama niat baik orang.", konstruk: "Ag" },
  { teks: "Aku sering memikirkan perasaan orang sebelum bicara.", konstruk: "Ag" },
  { teks: "Kalau ditegur di depan orang, aku tidak gampang baper.", konstruk: "St" },
  { teks: "Aku jarang overthinking soal hal yang sudah lewat.", konstruk: "St" },
  { teks: "Waktu dikejar deadline, aku tetap bisa berpikir jernih.", konstruk: "St" },
  { teks: "Aku tidak masalah mengerjakan sesuatu yang arahnya belum jelas.", konstruk: "Am" },
  { teks: "Aku bisa jalan duluan walaupun infonya belum lengkap.", konstruk: "Am" },
  { teks: "Rencana yang berubah di tengah jalan buat aku biasa saja.", konstruk: "Am" },
];

export const PAGES = [
  { judul: "Cara kamu menelusuri sesuatu", warna: "#38BDF8" },
  { judul: "Hal yang kamu nikmati", warna: "#009FE3" },
  { judul: "Cara kamu menjalani kerjaan", warna: "#0284C7" },
  { judul: "Cara kamu mulai dan menyelesaikan", warna: "#16A34A" },
  { judul: "Kamu waktu bareng orang lain", warna: "#0284C7" },
  { judul: "Saat keadaan tidak menentu", warna: "#009FE3" },
];
export const PER_PAGE = 6;
export const PAGE_COUNT = 6;

// Label ujung skala (AC-A4.4)
export const SCALE = ["Nggak banget", "Kurang", "Lumayan", "Aku banget"];

// Halaman n berisi item 6n..6n+5, yaitu dua konstruk. Judul halaman di PAGES
// mengikuti pasangan itu (mis. halaman 6 = tenang saat ditekan + hal yang belum jelas).
export function pageItems(page: number): number[] {
  return Array.from({ length: PER_PAGE }, (_, i) => page * PER_PAGE + i);
}

export type Band = "Kuat banget" | "Kuat" | "Cukup" | "Perlu dilatih";

// Pita interpretasi (§5.3): Kuat banget · Kuat · Cukup · Perlu dilatih
export function band(score: number): Band {
  if (score >= 11) return "Kuat banget";
  if (score >= 9) return "Kuat";
  if (score >= 7) return "Cukup";
  return "Perlu dilatih";
}

export type Scores = Record<ConstructCode, number>;

export interface ScoreSummary {
  scores: Scores;
  bands: Record<ConstructCode, Band>;
  extremes: number; // berapa kali menjawab di ujung skala (1 atau 4)
  usedAllPoints: boolean;
  topRiasec: ConstructCode[];
}

export function isComplete(answers: (number | null)[]): answers is number[] {
  return answers.length === ITEMS.length && answers.every((a) => a !== null && a >= 1 && a <= 4);
}

// Jawaban disimpan per indeks ITEMS (bukan per urutan tampil).
export function scoreAnswers(answers: number[]): ScoreSummary {
  if (!isComplete(answers)) throw new Error("Jawaban belum lengkap");
  const scores = {} as Scores;
  const bands = {} as Record<ConstructCode, Band>;
  for (const c of CONSTRUCTS) scores[c.kode] = 0;
  ITEMS.forEach((it, i) => (scores[it.konstruk] += answers[i]));
  for (const c of CONSTRUCTS) bands[c.kode] = band(scores[c.kode]);
  const riasec: ConstructCode[] = ["R", "I", "A", "S", "E", "C"];
  const topRiasec = [...riasec].sort((a, b) => scores[b] - scores[a] || riasec.indexOf(a) - riasec.indexOf(b));
  return {
    scores,
    bands,
    extremes: answers.filter((a) => a === 1 || a === 4).length,
    usedAllPoints: [1, 2, 3, 4].every((v) => answers.includes(v)),
    topRiasec,
  };
}
