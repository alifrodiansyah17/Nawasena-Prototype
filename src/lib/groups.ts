import type { Level } from "./level";

// Label kelompok Bagian 5 ditentukan dari posisi, bukan dari model (AC-A6.1–A6.3).
export type Group = "keinginan" | "terbentuk" | "target" | "relevan" | null;
export const GROUP_LABEL: Record<Exclude<Group, null>, string> = {
  keinginan: "Sesuai keinginanmu",
  terbentuk: "Sudah terbentuk di kamu",
  target: "Sesuai target karirmu",
  relevan: "Relevan dengan karirmu sekarang",
};
export function groupFor(index: number, level: Level, hasTarget: boolean): Group {
  if (!hasTarget) return null;
  if (level === "entry") return index < 3 ? "keinginan" : "terbentuk";
  return index === 0 ? "target" : "relevan";
}
