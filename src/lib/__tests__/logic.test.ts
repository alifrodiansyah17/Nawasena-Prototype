import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { band, ITEMS, pageItems, scoreAnswers } from "../quiz";
import { levelFromAge, levelFromWorkYears } from "../level";
import { builtCvToText, composeBullet, draftProfile, emptyBuiltCv } from "../cv-text";
import { groupFor } from "../groups";
import { pickArchetype } from "../archetypes";
import { detectContact } from "../format";
import { ROLES, roleById } from "../roles";

describe("kuis", () => {
  it("punya 36 item, 3 per konstruk", () => {
    expect(ITEMS).toHaveLength(36);
    const per = ITEMS.reduce<Record<string, number>>((m, i) => ((m[i.konstruk] = (m[i.konstruk] ?? 0) + 1), m), {});
    expect(Object.values(per).every((n) => n === 3)).toBe(true);
  });
  it("halaman berisi 6 item berurutan", () => {
    expect(pageItems(5)).toEqual([30, 31, 32, 33, 34, 35]);
  });
  it("pita interpretasi", () => {
    expect([12, 11, 10, 9, 8, 7, 6, 3].map(band)).toEqual(["Kuat banget", "Kuat banget", "Kuat", "Kuat", "Cukup", "Cukup", "Perlu dilatih", "Perlu dilatih"]);
  });
  it("skor per konstruk 3–12 dan menolak jawaban kosong", () => {
    const all4 = scoreAnswers(Array(36).fill(4));
    expect(all4.scores.R).toBe(12);
    expect(all4.extremes).toBe(36);
    expect(all4.usedAllPoints).toBe(false);
    expect(() => scoreAnswers([...Array(35).fill(2), null] as never)).toThrow();
  });
  it("RIASEC teratas", () => {
    const a = Array(36).fill(1);
    [9, 10, 11].forEach((i) => (a[i] = 4)); // S
    expect(scoreAnswers(a).topRiasec[0]).toBe("S");
  });
});

describe("level", () => {
  const today = new Date("2026-10-15T00:00:00");
  it("dari usia (AC-00.1, AC-00.4)", () => {
    expect(levelFromAge("2001-10-15", today)).toBe("entry"); // 25
    expect(levelFromAge("2000-10-14", today)).toBe("mid"); // 26
    expect(levelFromAge("1996-01-01", today)).toBe("mid"); // 30
    expect(levelFromAge("1995-01-01", today)).toBe("senior"); // 31
    expect(levelFromAge("bukan tanggal", today)).toBe("entry");
  });
  it("dari lama kerja, cadangan usia (§3.1)", () => {
    expect(levelFromWorkYears(2.9, "senior")).toBe("entry");
    expect(levelFromWorkYears(3, "entry")).toBe("mid");
    expect(levelFromWorkYears(8, "entry")).toBe("senior");
    expect(levelFromWorkYears(null, "mid")).toBe("mid");
  });
});

describe("CV builder", () => {
  it("merangkai bullet ATS dari tiga isian (AC-E3.3)", () => {
    expect(composeBullet({ tugas: "mengelola akun Instagram himpunan", jumlah: "12 bulan", hasil: "Menaikkan pengikut dari 800 ke 2.100." })).toBe(
      "Mengelola akun Instagram himpunan (12 bulan), menaikkan pengikut dari 800 ke 2.100.",
    );
    expect(composeBullet({ tugas: "", jumlah: "x", hasil: "y" })).toBe("");
  });
  it("teks CV satu kolom, entri kosong dibuang", () => {
    const cv = emptyBuiltCv();
    cv.diri = { nama: "Rani", kota: "Surabaya", hp: "+62812", email: "r@x.id", linkedin: "" };
    cv.pendidikan = { gelar: "S1 Administrasi Bisnis", kampus: "Unair", kota: "Surabaya", lulus: "2025", ipk: "" };
    cv.org = [{ peran: "Bendahara", nama: "BEM", mulai: "2023", selesai: "2024", bullets: [{ tugas: "mencatat kas", jumlah: "", hasil: "" }] }];
    cv.kerja = [{ posisi: "", tempat: "", mulai: "", selesai: "", bullets: [] }];
    cv.keahlian = ["Excel"];
    cv.profil = draftProfile(cv);
    const text = builtCvToText(cv);
    expect(text).toContain("PROYEK DAN ORGANISASI");
    expect(text).not.toContain("PENGALAMAN KERJA");
    expect(cv.profil).toContain("Lulusan S1 Administrasi Bisnis Unair");
  });
});

describe("Bagian 5", () => {
  it("label kelompok mengikuti posisi (AC-A6.1–A6.3)", () => {
    expect([0, 2, 3, 5].map((i) => groupFor(i, "entry", true))).toEqual(["keinginan", "keinginan", "terbentuk", "terbentuk"]);
    expect([0, 1, 5].map((i) => groupFor(i, "senior", true))).toEqual(["target", "relevan", "relevan"]);
    expect(groupFor(0, "mid", false)).toBeNull();
  });
  it("tabel peran unik dan gaji terisi", () => {
    expect(new Set(ROLES.map((r) => r.id)).size).toBe(ROLES.length);
    expect(ROLES.every((r) => r.gaji.every(Boolean))).toBe(true);
    expect(roleById("data_analyst")?.nama).toBe("Data Analyst");
  });
});

describe("arketipe dan login", () => {
  it("arketipe deterministik", () => {
    const s = scoreAnswers(Array(36).fill(3));
    expect(pickArchetype(s.scores, "I").kode).toBe("analyst");
  });
  it("deteksi email atau nomor HP (AC-02.2b)", () => {
    expect(detectContact("Rani@Email.com")).toEqual({ kind: "email", value: "rani@email.com" });
    expect(detectContact("0812 3456 7890")).toEqual({ kind: "phone", value: "+6281234567890" });
    expect(detectContact("halo")).toBeNull();
  });
});
