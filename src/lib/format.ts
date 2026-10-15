export function rupiah(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

export function tanggalJam(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
}

export function ukuranFile(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

// Deteksi isian login: email atau nomor HP (AC-02.2b).
export function detectContact(v: string): { kind: "email"; value: string } | { kind: "phone"; value: string } | null {
  const s = v.trim();
  if (!s) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { kind: "email", value: s.toLowerCase() };
  const digits = s.replace(/[^\d+]/g, "");
  if (/^(\+?62|0)8\d{7,12}$/.test(digits)) return { kind: "phone", value: normalizePhone(digits) };
  return null;
}

export function normalizePhone(s: string) {
  const d = s.replace(/[^\d]/g, "");
  if (d.startsWith("62")) return "+" + d;
  if (d.startsWith("0")) return "+62" + d.slice(1);
  return "+" + d;
}
