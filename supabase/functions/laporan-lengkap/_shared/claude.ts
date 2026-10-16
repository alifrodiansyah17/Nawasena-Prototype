// Panggilan ke AI dengan keluaran JSON terstruktur: Claude API atau Gemini API.
// Penyedia dipilih lewat secret AI_PROVIDER ("claude" / "gemini"). Kalau kosong: Claude kalau ANTHROPIC_API_KEY
// terisi, Gemini kalau hanya GEMINI_API_KEY yang terisi. Tanpa kunci sama sekali, isi laporan memakai contoh.
import { env } from "./umum.ts";
import { CONTOH_LAPORAN } from "./contoh_laporan.ts";

type Penyedia = "claude" | "gemini";
export function penyedia(): Penyedia | null {
  const pilih = (Deno.env.get("AI_PROVIDER") || "").toLowerCase();
  const adaClaude = !!Deno.env.get("ANTHROPIC_API_KEY"), adaGemini = !!Deno.env.get("GEMINI_API_KEY");
  if (pilih === "gemini") return adaGemini ? "gemini" : null;
  if (pilih === "claude") return adaClaude ? "claude" : null;
  return adaClaude ? "claude" : adaGemini ? "gemini" : null;
}

/** Mode tanpa AI: MODE_AI=contoh, atau kunci API penyedia yang dipilih belum diisi. Isi laporan memakai contoh. */
export function modeContoh(): boolean {
  return (Deno.env.get("MODE_AI") || "").toLowerCase() === "contoh" || !penyedia();
}

const PROFIL_CONTOH =
  "Ini contoh profil. Setelah analisis AI dinyalakan, bagian ini ditulis otomatis dari isian CV-mu. Untuk sekarang, tulis 2–3 kalimat tentang dirimu sendiri.";

// deno-lint-ignore no-explicit-any
function isiContoh(skema: any): any {
  const props = Object.keys(skema?.properties || {});
  const c = JSON.parse(JSON.stringify(CONTOH_LAPORAN));
  if (props.includes("arketipe")) {
    const pilih = (jalur: string, mau: string) => {
      const ids: string[] = skema.properties[jalur]?.properties?.id?.enum || [];
      return ids.includes(mau) ? mau : ids[0];
    };
    const b = c.bagian1;
    return {
      ...b,
      tahun_kerja: 0,
      tokoh_nyata: { id: pilih("tokoh_nyata", "retno"), why: b.tokoh_nyata?.why || "" },
      tokoh_fiksi: { id: pilih("tokoh_fiksi", "pepper"), why: b.tokoh_fiksi?.why || "" },
    };
  }
  if (props.includes("b2")) return c.lengkap.rencana;
  if (props.includes("tempat")) return c.lengkap.arahB;
  if (props.includes("peran")) return c.lengkap.arahA;
  if (props.includes("profil")) return { profil: PROFIL_CONTOH };
  if (props.includes("opsi")) return { peran_kini: "", tahun_kerja: 0, jenjang: "staf", opsi: [] };   // aplikasi memakai pilihan bawaan
  throw new Error("Tidak ada contoh untuk skema ini");
}

export interface HasilClaude<T> {
  data: T;
  pakai: { input: number; output: number };
  contoh?: boolean;   // true kalau isi dari contoh (mode tanpa AI)
}

export async function tanyaClaude<T>(opsi: {
  system: string;
  pesan: string;
  skema: Record<string, unknown>;
  maxTokens?: number;
  effort?: string;
}): Promise<HasilClaude<T>> {
  if (modeContoh()) {
    const jeda = Number(Deno.env.get("CONTOH_JEDA_MS") ?? "1500");   // supaya layar proses tetap terasa wajar
    if (jeda > 0) await new Promise((r) => setTimeout(r, jeda));
    return { data: isiContoh(opsi.skema) as T, pakai: { input: 0, output: 0 }, contoh: true };
  }
  if (penyedia() === "gemini") return tanyaGemini<T>(opsi);
  const model = Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-5-5";
  const effort = opsi.effort || Deno.env.get("CLAUDE_EFFORT") || "medium";
  const body = {
    model,
    max_tokens: opsi.maxTokens ?? 16000,
    system: [{ type: "text", text: opsi.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opsi.pesan }],
    output_config: { effort, format: { type: "json_schema", schema: opsi.skema } },
  };
  let terakhir = "";
  for (let coba = 1; coba <= 2; coba++) {
    const r = await fetch((Deno.env.get("ANTHROPIC_BASE_URL") || "https://api.anthropic.com") + "/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const t = await r.text();
    if (!r.ok) {
      terakhir = `Claude ${r.status}: ${t.slice(0, 500)}`;
      if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 4000)); continue; }
      throw new Error(terakhir);
    }
    const res = JSON.parse(t);
    const blok = (res.content || []).find((b: { type: string }) => b.type === "text");
    if (!blok) { terakhir = "Claude tidak mengembalikan teks"; continue; }
    if (res.stop_reason === "max_tokens") { terakhir = "Jawaban Claude terpotong (max_tokens)"; continue; }
    try {
      return {
        data: JSON.parse(blok.text) as T,
        pakai: { input: res.usage?.input_tokens ?? 0, output: res.usage?.output_tokens ?? 0 },
      };
    } catch {
      terakhir = "JSON dari Claude tidak bisa dibaca";
    }
  }
  throw new Error(terakhir || "Claude gagal");
}

// ---------------------------------------------------------------- Gemini API
// Skema JSON yang sama dikirim sebagai responseJsonSchema. Kalau model/API menolak skemanya,
// dicoba sekali lagi dengan mode JSON biasa dan skema ditulis di dalam pesan.

// deno-lint-ignore no-explicit-any
function skemaGemini(x: any): any {
  if (Array.isArray(x)) return x.map(skemaGemini);
  if (!x || typeof x !== "object") return x;
  // deno-lint-ignore no-explicit-any
  const o: any = {};
  for (const [k, v] of Object.entries(x)) {
    if (k === "additionalProperties") continue;
    o[k] = k === "properties" ? Object.fromEntries(Object.entries(v as object).map(([p, d]) => [p, skemaGemini(d)])) : skemaGemini(v);
  }
  return o;
}

// Buang karakter kontrol yang kadang terselip di teks keluaran (mis. \b), kecuali baris baru dan tab.
// deno-lint-ignore no-explicit-any
function bersihkan(x: any): any {
  if (typeof x === "string") return x.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  if (Array.isArray(x)) return x.map(bersihkan);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, bersihkan(v)]));
  return x;
}

async function tanyaGemini<T>(opsi: { system: string; pesan: string; skema: Record<string, unknown>; maxTokens?: number }): Promise<HasilClaude<T>> {
  // Model utama, lalu model cadangan kalau sedang penuh (503) atau kena batas kuota (429).
  // Model yang kena 429 diistirahatkan sampai waktu tunggu dari Google lewat, supaya tidak membanjiri API.
  // Panggilan baru tidak dimulai lewat GEMINI_BATAS_MS (bawaan 75 dtk), supaya fungsi selesai sebelum batas 150 detik.
  const model = [...new Set([
    Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash",
    Deno.env.get("GEMINI_MODEL_CADANGAN") || "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
  ])];
  const mulai = Date.now(), batas = Number(Deno.env.get("GEMINI_BATAS_MS") ?? "75000");
  const sisa = () => batas - (Date.now() - mulai);
  const tidur = (ms: number) => new Promise((s) => setTimeout(s, ms));
  const istirahat: Record<string, number> = {};   // model → waktu (ms) boleh dicoba lagi
  const tungguDari = (t: string) => {
    const d = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(t) || /retry in (\d+(?:\.\d+)?)s/i.exec(t);
    return d ? Math.ceil(Number(d[1]) * 1000) : 30000;
  };
  let m = 0, gagalIsi = 0;
  const maks = (opsi.maxTokens ?? 16000) + 8000;   // ruang tambahan untuk "thinking" model
  let pakaiSkema = true, terakhir = "";
  for (let coba = 1; sisa() > 0 && coba <= 12; coba++) {
    // pilih model yang tidak sedang istirahat; kalau semua istirahat, tunggu yang paling cepat selesai (kalau masih sempat)
    const siap = model.findIndex((_, i) => (istirahat[model[(m + i) % model.length]] || 0) <= Date.now());
    if (siap < 0) {
      const cepat = Math.min(...model.map((x) => istirahat[x])) - Date.now();
      if (cepat > sisa() || cepat > 60000) {
        throw new Error("Kuota Gemini sedang habis. Coba lagi beberapa saat lagi. (" + terakhir.slice(0, 200) + ")");
      }
      await tidur(Math.max(cepat, 1000));
      m = 0;   // setelah menunggu, mulai lagi dari model utama
      continue;
    }
    m = (m + siap) % model.length;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model[m])}:generateContent`;
    const pesan = pakaiSkema ? opsi.pesan
      : `${opsi.pesan}\n\nJawab HANYA dengan satu objek JSON yang mengikuti JSON Schema ini persis (semua field wajib diisi):\n${JSON.stringify(opsi.skema)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": env("GEMINI_API_KEY"), "content-type": "application/json" },
      signal: AbortSignal.timeout(Math.max(20000, 140000 - (Date.now() - mulai))),   // jangan lewati batas fungsi
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opsi.system }] },
        contents: [{ role: "user", parts: [{ text: pesan }] }],
        generationConfig: {
          maxOutputTokens: maks,
          responseMimeType: "application/json",
          ...(pakaiSkema ? { responseJsonSchema: skemaGemini(opsi.skema) } : {}),
        },
      }),
    });
    const t = await r.text();
    if (!r.ok) {
      terakhir = `Gemini ${model[m]} ${r.status}: ${t.slice(0, 500)}`;
      if (r.status === 400 && pakaiSkema && /schema/i.test(t)) { pakaiSkema = false; continue; }
      if (r.status === 429) { istirahat[model[m]] = Date.now() + tungguDari(t); continue; }
      if (r.status >= 500) { istirahat[model[m]] = Date.now() + 8000; continue; }
      throw new Error(terakhir);
    }
    const res = JSON.parse(t);
    const kand = res.candidates?.[0];
    // deno-lint-ignore no-explicit-any
    const teks = (kand?.content?.parts || []).filter((p: any) => !p.thought && typeof p.text === "string").map((p: any) => p.text).join("");
    if (kand?.finishReason === "MAX_TOKENS") { terakhir = "Jawaban Gemini terpotong (MAX_TOKENS)"; if (++gagalIsi >= 3) break; continue; }
    if (!teks) { terakhir = `Gemini tidak mengembalikan teks (${kand?.finishReason || res.promptFeedback?.blockReason || "tanpa alasan"})`; if (++gagalIsi >= 3) break; continue; }
    try {
      const bersih = teks.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
      return {
        data: bersihkan(JSON.parse(bersih)) as T,
        pakai: { input: res.usageMetadata?.promptTokenCount ?? 0, output: res.usageMetadata?.candidatesTokenCount ?? 0 },
      };
    } catch {
      terakhir = "JSON dari Gemini tidak bisa dibaca";
      if (++gagalIsi >= 3) break;
    }
  }
  throw new Error(terakhir || "Gemini gagal");
}
