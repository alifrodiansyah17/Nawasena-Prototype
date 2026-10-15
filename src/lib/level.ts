// Level tidak pernah ditampilkan ke pengguna (AC-00.2). Hanya dipakai untuk
// memilih jalur dan dikirim ke analytics.

export type Level = "entry" | "mid" | "senior";

export function ageOn(birthDate: string, today = new Date()): number | null {
  const d = new Date(birthDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  if (age < 10 || age > 90) return null;
  return age;
}

// AC-00.1: usia ≤ 25 → entry; 26–30 → mid; > 30 → senior. Tidak valid → entry (AC-00.4).
export function levelFromAge(birthDate: string | null | undefined, today = new Date()): Level {
  const age = birthDate ? ageOn(birthDate, today) : null;
  if (age === null) return "entry";
  if (age <= 25) return "entry";
  if (age <= 30) return "mid";
  return "senior";
}

// §3.1 v3.2: untuk pertanyaan target dan arah karir, level dibaca dari lama kerja di CV.
// < 3 tahun = entry, 3–7 = mid, ≥ 8 = senior. Tidak terbaca → pakai level usia.
export function levelFromWorkYears(years: number | null | undefined, fallback: Level): Level {
  if (years === null || years === undefined || Number.isNaN(years)) return fallback;
  if (years < 3) return "entry";
  if (years < 8) return "mid";
  return "senior";
}
