import type { ConstructCode, Scores } from "./quiz";

// 12 arketipe. Dipilih secara deterministik dari skor (bukan oleh model),
// supaya pasangan tokohnya bisa dikurasi manusia (AC-06.7).
//
// PERHATIAN TIM: pasangan tokoh di bawah adalah DRAF dan wajib ditinjau manusia
// sebelum rilis, lalu tiap kuartal (R11). Hanya nama dan alasan tertulis —
// tanpa foto, tanpa ilustrasi, tanpa kutipan (AC-06.4, AC-06.8).

export interface Archetype {
  kode: string;
  nama: string;
  warna: string;
  tokoh: { nama: string; peran: string; why: string };
  fiksi: { nama: string; asal: string; why: string };
}

const A = (kode: string, nama: string, warna: string, tokoh: Archetype["tokoh"], fiksi: Archetype["fiksi"]): Archetype => ({
  kode,
  nama,
  warna,
  tokoh,
  fiksi,
});

export const ARCHETYPES: Record<string, Archetype> = {
  maker: A("maker", "The Maker", "#0F766E",
    { nama: "B.J. Habibie", peran: "Insinyur pesawat, Presiden RI ke-3", why: "Sama-sama paling yakin kalau idenya sudah berbentuk dan bisa dicoba, bukan cuma di atas kertas." },
    { nama: "Hiro Hamada", asal: "Film Big Hero 6", why: "Belajar paling cepat lewat mencoba, dan tidak berhenti sampai rakitannya benar-benar jalan." }),
  fixer: A("fixer", "The Fixer", "#B45309",
    { nama: "Tri Mumpuni", peran: "Perintis listrik mikrohidro desa", why: "Sama-sama turun langsung ke masalahnya dan mencari jalan yang paling masuk akal dengan bahan yang ada." },
    { nama: "MacGyver", asal: "Serial MacGyver", why: "Tetap tenang waktu keadaannya kacau, lalu merakit jalan keluar dari apa yang ada di tangan." }),
  analyst: A("analyst", "The Analyst", "#4338CA",
    { nama: "Najwa Shihab", peran: "Jurnalis", why: "Sama-sama tidak berhenti di jawaban pertama. Kalian bertanya sampai ketemu sebabnya." },
    { nama: "Hermione Granger", asal: "Harry Potter", why: "Persiapannya matang, catatannya rapi, dan kalau ada yang keliru dia yang bicara duluan." }),
  explorer: A("explorer", "The Explorer", "#0369A1",
    { nama: "Pratiwi Sudarmono", peran: "Ilmuwan mikrobiologi", why: "Sama-sama tertarik pada pertanyaan yang belum ada jawabannya, dan berani masuk ke wilayah yang belum dipetakan." },
    { nama: "Moana", asal: "Film Moana", why: "Penasaran pada apa yang ada di balik batas, dan tetap jalan walau petanya belum lengkap." }),
  spark: A("spark", "The Spark", "#9F1239",
    { nama: "Raditya Dika", peran: "Penulis dan pembuat film", why: "Sama-sama mengubah pengalaman sehari-hari jadi cerita yang bikin orang lain ikut terlibat." },
    { nama: "Jo March", asal: "Novel Little Women", why: "Idenya banyak, berani menuliskannya, dan senang kalau karyanya dibaca orang." }),
  crafter: A("crafter", "The Crafter", "#7C3AED",
    { nama: "Iwan Tirta", peran: "Perancang batik", why: "Sama-sama teliti pada detail dan tidak puas sebelum hasilnya enak dilihat." },
    { nama: "Remy", asal: "Film Ratatouille", why: "Peka pada hal kecil yang orang lain lewatkan, dan sabar menyempurnakan karyanya." }),
  anchor: A("anchor", "The Anchor", "#047857",
    { nama: "Butet Manurung", peran: "Pendidik, pendiri Sokola Rimba", why: "Sama-sama sabar menemani orang lain berkembang dengan cara yang paling cocok buat mereka." },
    { nama: "Samwise Gamgee", asal: "The Lord of the Rings", why: "Bisa diandalkan, tetap tenang, dan selalu ada waktu temannya butuh." }),
  mentor: A("mentor", "The Mentor", "#0E7490",
    { nama: "Ki Hajar Dewantara", peran: "Tokoh pendidikan nasional", why: "Sama-sama senang menjelaskan dan percaya setiap orang bisa berkembang kalau dituntun dengan tepat." },
    { nama: "Iroh", asal: "Avatar: The Last Airbender", why: "Hangat, sabar, dan pandai membuat orang lain memahami dirinya sendiri." }),
  conductor: A("conductor", "The Conductor", "#1D4ED8",
    { nama: "Retno Marsudi", peran: "Diplomat, Menteri Luar Negeri RI 2014–2024", why: "Sama-sama tenang di situasi tegang, rapi menyiapkan langkah, dan pandai menyatukan banyak pihak." },
    { nama: "Pepper Potts", asal: "Film Iron Man (Marvel)", why: "Tetap tenang waktu sekitarnya kacau, merapikan urusan banyak orang, lalu dipercaya memimpin." }),
  catalyst: A("catalyst", "The Catalyst", "#C2410C",
    { nama: "William Tanuwijaya", peran: "Pendiri perusahaan teknologi", why: "Sama-sama berani memulai sesuatu yang besar dan mengajak orang lain ikut percaya." },
    { nama: "Judy Hopps", asal: "Film Zootopia", why: "Punya target yang jelas, tidak gampang menyerah, dan mengajak orang ikut bergerak." }),
  keeper: A("keeper", "The Keeper", "#15803D",
    { nama: "Sri Mulyani Indrawati", peran: "Ekonom, Menteri Keuangan", why: "Sama-sama teliti pada angka dan aturan, dan menjaga semuanya tetap tertib walau tekanannya besar." },
    { nama: "Monica Geller", asal: "Serial Friends", why: "Semua tertata di tempatnya, dan justru itu yang membuat teman-temannya merasa tenang." }),
  navigator: A("navigator", "The Navigator", "#1E40AF",
    { nama: "Ignasius Jonan", peran: "Pembenah layanan kereta api", why: "Sama-sama menata sistem yang berantakan jadi teratur, dan tetap menyesuaikan saat keadaan berubah." },
    { nama: "Helen Parr", asal: "Film The Incredibles", why: "Rapi mengatur banyak hal sekaligus, dan cepat menyesuaikan rencana waktu keadaan berubah." }),
};

// Varian dipilih dari perbandingan dua konstruk gaya kerja.
const RULES: Record<string, [string, string, ConstructCode, ConstructCode]> = {
  R: ["maker", "fixer", "Cs", "Am"],
  I: ["analyst", "explorer", "Cs", "O"],
  A: ["crafter", "spark", "Cs", "Ex"],
  S: ["anchor", "mentor", "St", "Ex"],
  E: ["conductor", "catalyst", "Cs", "O"],
  C: ["keeper", "navigator", "Cs", "Am"],
};

export function pickArchetype(scores: Scores, topRiasec: ConstructCode): Archetype {
  const rule = RULES[topRiasec] ?? RULES.I;
  const [a, b, ca, cb] = rule;
  return ARCHETYPES[scores[ca] >= scores[cb] ? a : b];
}
