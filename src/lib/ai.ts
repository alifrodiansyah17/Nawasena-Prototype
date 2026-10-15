import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod/v4";
import { AI_MODEL } from "./config";
import { CONSTRUCTS, ITEMS, type ScoreSummary } from "./quiz";
import { rolesTableText, roleById } from "./roles";
import type { Archetype } from "./archetypes";
import type { Level } from "./level";
import { FactsSchema, FITS, FreeSchema, PaidSchema, TYPES, type CareerType, type CvFacts, type FreePart, type PaidPart } from "./report-schema";

let _client: Anthropic | null = null;
const anthropic = () => (_client ??= new Anthropic());

// Prompt statis: aturan bahasa, instrumen, dan tabel peran. Identik di semua
// panggilan supaya bisa di-cache (tuas margin #1 di §4.2).
const STYLE = `Kamu menulis Peta Potensimu untuk Nawasena: bacaan tentang diri sendiri dan arah karir untuk pekerja muda Indonesia. Pembacanya sebagian besar Gen-Z yang baru selesai mengisi kuis tentang dirinya, jadi satu kata yang salah pilih bisa terbaca sebagai rapor.

Cara menulis
- Bahasa Indonesia sehari-hari yang wajar, orang kedua "kamu". Kalimat pendek, subjek jelas, langsung ke inti. Bayangkan teman yang pintar dan enak diajak ngobrol sambil ngopi, bukan dosen dan bukan teman nongkrong.
- Kata kerja memakai bentuk baku (menyelesaikan, memutuskan, memperbaiki), bukan akhiran -in yang dipaksakan. Pakai "tidak", "saja", "seperti", bukan "nggak", "aja", "kayak". Tidak ada "lo/gue", umpatan, atau singkatan chat.
- Kosakata Gen-Z yang memang dipakai sehari-hari boleh (badmood, baper, overthinking, deadline). Kata yang umurnya pendek tidak (slay, gaskeun, spill).
- Jangan pakai kata: Anda, laporan, asesmen (pakai kuis), peran (pakai posisi, arah karir, atau pekerjaan), vonis, menimbang, waspadai, kelemahan, wajib, harus segera, sejauh mana, berlaku, sekadar, kecenderungan.
- Tidak menghakimi. Skor rendah tidak pernah ditulis sebagai kekurangan; sebut sebagai hal yang belum sering dipakai atau masih perlu dilatih. Ujung atas boleh apa adanya.
- Tidak mengarahkan. Sajikan pilihan, jangan menyuruh. Tidak menjanjikan pekerjaan.
- Kiasan hanya kalau langsung dimengerti. Kalau perlu dijelaskan, tulis apa adanya.
- Tanpa tanda kutip. Susun ulang kalimatnya supaya kutipan tidak perlu.
- Tulis karakter asli (—, ·, →), bukan entitas HTML. Tanpa markdown, tanpa bullet di dalam teks.
- Jangan pernah menyebut level pengguna (entry, mid, senior) dalam bentuk apa pun.
- Jangan mengarang fakta yang tidak ada di CV atau jawaban kuis. Kalau angka tidak ada di CV, tulis [jumlah] sebagai tempat isian, jangan menebak.
- Jangan menulis kisaran gaji di mana pun; gaji diisi sistem dari tabel internal.

Instrumen kuis
36 pernyataan, skala 1–4 (1 Nggak banget, 4 Aku banget), tanpa titik tengah. 12 konstruk × 3 item, skor per konstruk 3–12.
Pita: ≥11 Kuat banget · ≥9 Kuat · ≥7 Cukup · <7 Perlu dilatih.
Konstruk:
${CONSTRUCTS.map((c) => `- ${c.kode}: ${c.nama}`).join("\n")}
Item (nomor · konstruk · kalimat):
${ITEMS.map((it, i) => `${i + 1} · ${it.konstruk} · ${it.teks}`).join("\n")}

Enam bagian Peta Potensimu
1 Kenalan Sama Dirimu — julukan, yang paling kamu banget (tiap butir dengan chip asal temuannya), yang masih perlu dilatih. Gratis.
2 Tipe Karirmu — tujuh tipe: I (spesialis murni), Generalis, T (spesialis yang nyambung), V (spesialis yang melebar), Pi (dua keahlian, ditulis π di teks), M (banyak keahlian), X (spesialis yang memimpin). Keahlian dibaca dari lama dan bukti kerja di satu bidang (CV); keluasan dari bidang lain yang pernah dipegang plus jawaban soal rasa ingin tahu dan hal baru; sinyal memimpin dari jawaban soal mengambil alih dan pengalaman memimpin orang. Posisi sekarang, tipe yang sedang dituju, dan dua jalan dari situ yang merujuk ke nomor arah di Bagian 5.
3 Keunggulan dan Tantanganmu — tiga ubin angka yang bisa dibaca dalam dua detik (diambil dari CV), keunggulan, tantangan, perkenalan 60 detik (ditulis memakai saya karena diucapkan ke pewawancara), tiga pertanyaan wawancara yang paling mungkin muncul untuk arah teratas.
4 Catatan buat CV-mu — sandingan sebelum–sesudah memakai kalimat ASLI dari CV, yang paling cepat terasa efeknya, yang bikin CV makin kuat. Spesifik pada CV ini, bukan tips umum. Tiap catatan memuat apa yang kurang, kenapa itu masalah, dan contoh perbaikannya.
5 Enam Arah Karir Berikutnya — enam arah dari tabel referensi, satu halaman per arah, plus tempat kerja yang paling pas.
6 Langkah yang Bisa Kamu Lakukan Sekarang — tiga langkah kecil minggu ini, yang perlu kamu tahu soal hasil ini (seberapa bisa dipegang polanya, misalnya dari banyaknya jawaban di ujung skala), dan penutup bahwa ini potret hari ini, bukan garis finis.

Aturan komposisi Bagian 5
- Pilih role_id HANYA dari tabel referensi di bawah. Tidak ada arah yang dobel.
- Kalau pengguna mengisi target dan jalurnya "keinginan": arah 1–3 peran di bidang yang dia bayangkan, urut dari yang paling cocok dengan kuis dan CV; arah 4–6 peran yang paling banyak memakai kemampuan yang sudah terbukti di CV dan kuis.
- Kalau pengguna mengisi target dan jalurnya "target": arah 1 adalah role yang dia sebut atau padanan terdekatnya di tabel; arah 2–6 dibaca dari karir dan gaya kerjanya saat ini.
- Kalau target dilewati: enam arah diurutkan dari bekal yang paling dekat.
- Arah dari keinginan tetap ditulis jujur. Jarak antara keinginan dan bekal disebut di menantang dan disiapkan, tanpa kata yang menghakimi.
- Kalau target terlalu umum atau tidak ada padanannya, tulis tafsiranmu dalam satu kalimat di tafsiran_target.

Tabel referensi peran (id | nama | rumpun | fungsi)
${rolesTableText()}`;

const SYSTEM: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
  { type: "text", text: STYLE, cache_control: { type: "ephemeral", ttl: "1h" } },
];

export interface ReportInput {
  nickname: string;
  age: number | null;
  level: Level;
  cvSource: "uploaded" | "built";
  cvText: string;
  attachments: string;
  summary: ScoreSummary;
  answers: number[];
  archetype: Archetype;
  target: string | null;
}

function userContext(inp: ReportInput): string {
  const s = inp.summary;
  const rows = CONSTRUCTS.map((c) => `${c.kode} (${c.nama}): ${s.scores[c.kode]} · ${s.bands[c.kode]}`).join("\n");
  const ans = inp.answers.map((a, i) => `${i + 1}:${a}`).join(" ");
  const composition = !inp.target
    ? "tanpa target"
    : inp.level === "entry"
      ? "keinginan (arah 1–3 sesuai keinginan, arah 4–6 sudah terbentuk)"
      : "target (arah 1 sesuai target karir, arah 2–6 relevan dengan karir sekarang)";
  return `Data pengguna
Panggilan: ${inp.nickname}
Usia: ${inp.age ?? "tidak diketahui"}
Asal CV: ${inp.cvSource === "built" ? "disusun di Nawasena (belum pernah punya CV)" : "diunggah sendiri"}
Arketipe (sudah ditentukan sistem): ${inp.archetype.nama}
Target karir: ${inp.target ? inp.target : "dilewati"}
Jalur komposisi Bagian 5: ${composition}

Skor kuis
${rows}
Jawaban di ujung skala: ${s.extremes} dari 36. Memakai keempat angka: ${s.usedAllPoints ? "ya" : "tidak"}.
Jawaban per item (nomor:nilai): ${ans}

CV
<cv>
${inp.cvText}
</cv>
${inp.attachments ? `\nLampiran\n<lampiran>\n${inp.attachments}\n</lampiran>` : ""}`;
}

async function run<T extends z.ZodType>(schema: T, effort: "low" | "medium" | "high", messages: Anthropic.Beta.Messages.BetaMessageParam[], maxTokens: number) {
  const stream = anthropic().beta.messages.stream({
    model: AI_MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system: SYSTEM,
    messages,
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("Model menolak permintaan ini");
  if (msg.stop_reason === "max_tokens") throw new Error("Keluaran model terpotong (max_tokens)");
  if (!msg.parsed_output) throw new Error("Keluaran model tidak sesuai skema");
  return { data: msg.parsed_output as z.infer<T>, usage: msg.usage };
}

// Panggilan 1: baca CV (ekstraksi, effort rendah — tuas margin #2).
export async function readCvFacts(cvText: string): Promise<CvFacts> {
  const { data } = await run(
    FactsSchema,
    "low",
    [
      {
        role: "user",
        content: `Baca CV berikut dan isi fakta yang diminta. Hitung lama_kerja_tahun hanya dari pekerjaan penuh waktu atau kontrak; magang, freelance kecil, asisten lab, dan organisasi kampus tidak dihitung.\n<cv>\n${cvText}\n</cv>`,
      },
    ],
    4000,
  );
  return data;
}

// Panggilan 2: Bagian 1 (gratis). Effort medium supaya layar proses cepat selesai.
export async function writeFreePart(inp: ReportInput) {
  const res = await run(
    FreeSchema,
    "medium",
    [
      {
        role: "user",
        content: `${userContext(inp)}\n\nTulis Bagian 1 (Kenalan Sama Dirimu). Butir paling dan dilatih harus berasal dari skor dan jawaban di atas, dan kalau bisa dihubungkan dengan bukti di CV. Chip menyebut asal temuannya (mis. 3 dari 3 jawaban di ujung skala, atau Dua jawaban yang tampak bertabrakan).`,
      },
    ],
    16000,
  );
  return { data: normalizeFree(res.data), usage: res.usage };
}

// Panggilan 3: Bagian 2–6 (berbayar). Effort high: ini bagian termahal produk.
export async function writePaidPart(inp: ReportInput, free: FreePart) {
  const res = await run(
    PaidSchema,
    "high",
    [
      {
        role: "user",
        content: `${userContext(inp)}\n\nBagian 1 yang sudah dibaca pengguna:\n${JSON.stringify(free)}\n\nTulis Bagian 2 sampai 6. Jaga supaya konsisten dengan Bagian 1, dan rujukan antarbagian memakai nomor yang benar.${inp.cvSource === "built" ? " CV ini disusun di Nawasena dari isian pengguna; Bagian 4 berisi cara memperkuat CV itu lebih jauh." : ""}`,
      },
    ],
    64000,
  );
  return { data: normalizePaid(res.data), usage: res.usage };
}

export function normalizeFree(f: FreePart): FreePart {
  return { ...f, paling: f.paling.slice(0, 4), dilatih: f.dilatih.slice(0, 3) };
}

function toType(v: string): CareerType {
  const x = v.trim().replace(/π/g, "Pi").replace(/-?shape$/i, "");
  return (TYPES.find((t) => t.toLowerCase() === x.toLowerCase()) ?? "Generalis") as CareerType;
}

export function normalizePaid(p: PaidPart): PaidPart {
  const seen = new Set<string>();
  const arah = p.bagian5.arah.filter((a) => {
    if (!roleById(a.role_id) || seen.has(a.role_id)) return false;
    seen.add(a.role_id);
    return true;
  });
  if (arah.length < 6) throw new Error(`Hanya ${arah.length} arah valid dari tabel referensi`);
  return {
    ...p,
    bagian2: {
      ...p.bagian2,
      tipe_sekarang: toType(p.bagian2.tipe_sekarang),
      tipe_dituju: toType(p.bagian2.tipe_dituju),
      jalan: p.bagian2.jalan.slice(0, 2).map((j) => ({ ...j, ke: toType(j.ke) })),
    },
    bagian3: { ...p.bagian3, ubin: p.bagian3.ubin.slice(0, 3), pertanyaan: p.bagian3.pertanyaan.slice(0, 3) },
    bagian5: {
      ...p.bagian5,
      arah: arah.slice(0, 6),
      tempat: p.bagian5.tempat.map((t) => ({ ...t, cocok: (FITS as readonly string[]).includes(t.cocok) ? t.cocok : "Cocok" })),
    },
    bagian6: { ...p.bagian6, langkah: p.bagian6.langkah.slice(0, 3) },
  };
}
