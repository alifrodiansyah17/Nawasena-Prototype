import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@anthropic-ai/sdk", () => ({ default: class {} }));
vi.mock("@anthropic-ai/sdk/helpers/beta/zod", () => ({ betaZodOutputFormat: () => ({}) }));

import { normalizePaid } from "../ai";
import type { PaidPart } from "../report-schema";

const arah = (id: string) => ({
  role_id: id, label: "", fungsi: "", dibutuhkan: "", dimiliki: "", kenapa: "", hari: "", menantang: "", jalur: "",
  industri_dekat: "", industri_alternatif: "", disiapkan: "",
});

const base = (ids: string[]) =>
  ({
    bagian2: { tipe_sekarang: "T", tipe_dituju: "Pi", judul: "", penjelasan: "", keahlian: "", keluasan: "", sinyal_memimpin: "", jalan: [], catatan: "" },
    bagian3: { ubin: [], keunggulan: [], tantangan: [], penutup: "", cerita60: { siapa: "", bukti: "", kenapa: "" }, pertanyaan_untuk: "", pertanyaan: [] },
    bagian4: { pembuka: "", banding: [], cepat: [], kuat: [], penutup: "" },
    bagian5: { tafsiran_target: "", pembuka: "", arah: ids.map(arah), penghubung: "", kurang_cocok: "", tempat: [], ciri_betah: [], kata_cocok: [], kata_tanya: [] },
    bagian6: { langkah: [], soal_hasil: "", penutup: "" },
  }) as unknown as PaidPart;

describe("normalizePaid", () => {
  it("membuang id di luar tabel dan duplikat (AC-A6.5)", () => {
    const out = normalizePaid(base(["data_analyst", "data_analyst", "bukan_id", "business_analyst", "ld_officer", "hrbp", "product_owner", "qa_engineer", "copywriter"]));
    expect(out.bagian5.arah.map((a) => a.role_id)).toEqual(["data_analyst", "business_analyst", "ld_officer", "hrbp", "product_owner", "qa_engineer"]);
  });
  it("gagal kalau arah valid kurang dari 6", () => {
    expect(() => normalizePaid(base(["data_analyst", "x", "y"]))).toThrow();
  });
});

describe("normalizePaid nilai bebas", () => {
  it("memetakan tipe karir dan tingkat kecocokan", () => {
    const p = base(["data_analyst", "business_analyst", "ld_officer", "hrbp", "product_owner", "qa_engineer"]);
    p.bagian2.tipe_sekarang = "π-shape";
    p.bagian2.tipe_dituju = "aneh";
    p.bagian5.tempat = [{ nama: "x", cocok: "sangat cocok", isi: "" }];
    const out = normalizePaid(p);
    expect(out.bagian2.tipe_sekarang).toBe("Pi");
    expect(out.bagian2.tipe_dituju).toBe("Generalis");
    expect(out.bagian5.tempat[0].cocok).toBe("Cocok");
  });
});
