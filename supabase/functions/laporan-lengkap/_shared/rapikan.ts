// Pembersih teks hasil AI sebelum disimpan (versi aplikasi: web/aset/api.js → rapikanLaporan, isinya sama).
//  - kode internal kuis yang ikut tertulis: "(E & Cs)", "(I)", "sesuai kuis To dan St"
//  - kurung siku di sekitar angka yang sudah ada: "[32]" → "32"
const KODE = "(?:Cs|Ex|Ag|St|To|R|I|A|S|E|C|O)";
const SAMBUNG = "\\s*(?:&|dan|,|/)\\s*";
const KURUNG_KODE = new RegExp(`\\s*\\((?:sesuai |dari |lihat )?(?:kuis |hasil kuis )?${KODE}(?:${SAMBUNG}${KODE})*\\)`, "g");
const KUIS_KODE = new RegExp(`\\b(kuis|hasil kuis)\\s+${KODE}(?:${SAMBUNG}${KODE})*\\b`, "g");
const KURUNG_ANGKA = /\[\s*((?:[-+]?(?:IDR|Rp|USD|\$)?\s?[-+]?\d[\d.,]*\s?(?:%|[KMBkmb]|rb|jt|juta|miliar|M)?))\s*\]/g;

export function rapikanTeks(t: string): string {
  return t
    .replace(KURUNG_KODE, "")
    .replace(KUIS_KODE, "$1")
    .replace(KURUNG_ANGKA, "$1")
    .replace(/ {2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1");
}

/** Rapikan semua teks di dalam objek/array secara mendalam. */
export function rapikanIsi<T>(x: T): T {
  if (typeof x === "string") return rapikanTeks(x) as unknown as T;
  if (Array.isArray(x)) return x.map((v) => rapikanIsi(v)) as unknown as T;
  if (x && typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) o[k] = rapikanIsi(v);
    return o as T;
  }
  return x;
}

/** Tebakan kasar bahasa teks CV: "Inggris" atau "Indonesia". */
export function bahasaTeks(t: string): "Inggris" | "Indonesia" {
  const kata = String(t || "").toLowerCase().match(/[a-z]+/g) || [];
  const ID = new Set(["dan", "yang", "di", "untuk", "dengan", "dalam", "pada", "sebagai", "dari", "ke", "serta", "memimpin", "mengelola", "meningkatkan", "membuat", "tim", "selama"]);
  const EN = new Set(["and", "the", "of", "for", "with", "in", "to", "as", "led", "managed", "increased", "developed", "team", "by", "on", "at", "of"]);
  let id = 0, en = 0;
  for (const w of kata) { if (ID.has(w)) id++; if (EN.has(w)) en++; }
  return en > id * 1.3 ? "Inggris" : "Indonesia";
}
