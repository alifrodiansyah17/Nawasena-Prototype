// Panggilan ke Claude API dengan keluaran JSON terstruktur.
import { env } from "./umum.ts";
import { CONTOH_LAPORAN } from "./contoh_laporan.ts";

/** Mode tanpa AI: MODE_AI=contoh, atau ANTHROPIC_API_KEY belum diisi. Isi laporan memakai contoh. */
export function modeContoh(): boolean {
  return (Deno.env.get("MODE_AI") || "").toLowerCase() === "contoh" || !Deno.env.get("ANTHROPIC_API_KEY");
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
