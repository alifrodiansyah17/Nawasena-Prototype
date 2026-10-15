import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
vi.mock("server-only", () => ({}));
import { renderCvPdf, renderReportPdf } from "../pdf";
import { ARCHETYPES } from "../archetypes";
import { roleById } from "../roles";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { PaidSchema, FreeSchema } from "../report-schema";
import { emptyBuiltCv } from "../cv-text";

const OUT = process.env.PDF_OUT;

describe.skipIf(!OUT)("pdf smoke", () => {
  it("skema keluaran bisa dikompilasi", () => {
    const f = betaZodOutputFormat(PaidSchema) as unknown as { schema: object };
    fs.writeFileSync(`${OUT}/paid-schema.json`, JSON.stringify(f, null, 1));
    expect(JSON.stringify(betaZodOutputFormat(FreeSchema)).length).toBeGreaterThan(100);
  });
  it("render PDF laporan dan CV", async () => {
    const ids = ["talent_competency", "ld_officer", "mt_hc", "financial_analyst", "project_control", "risk_analyst"];
    const card = { judul: "Mengatur orang dan langkah", isi: "Kalau kelompok belum punya pemimpin, kamu yang mulai mengatur — dan kamu lebih tenang kalau aturannya jelas · contoh." };
    const peta = {
      archetype: ARCHETYPES.conductor,
      free: { julukan_sub: "Mengatur dengan Tenang", cara_kerja: "Kamu tipe yang mulai mengatur waktu kelompok belum punya arah.", paling: [{ ...card, chip: "3 dari 3 jawaban di ujung skala" }, { ...card, chip: "4 jawaban di ujung skala" }], dilatih: [card, card], catatan_kolom: "Dua kolom ini sama-sama normal." },
      paid: {
        bagian2: { tipe_sekarang: "Generalis", tipe_dituju: "Pi", judul: "Generalis, dengan peluang jadi π", penjelasan: "Bukti terdalam di CV-mu ada di model keuangan.", keahlian: "Tiga proyek", keluasan: "AjakJago", sinyal_memimpin: "Memimpin enam orang", jalan: [{ ke: "T", judul: "Menebal jadi T", isi: "Dalami SDM.", rujukan: "Arah 2 dan 3 di Bagian 5" }], catatan: "Catatan." },
        bagian3: { ubin: [{ angka: "2", label: "peran mendampingi" }, { angka: "3", label: "proyek" }, { angka: "6 orang", label: "tim" }], keunggulan: [card], tantangan: [card], penutup: "Penutup.", cerita60: { siapa: "Saya mahasiswa.", bukti: "Di AjakJago.", kenapa: "Melihat orang berkembang." }, pertanyaan_untuk: "Untuk arah 1 dan 2.", pertanyaan: [{ tanya: "Bagaimana kamu tahu?", dicek: "Dampak.", cerita: "AjakJago.", kurang_kuat: "Berhenti di peserta puas." }] },
        bagian4: { pembuka: "CV-mu lengkap.", banding: [{ sebelum: "Conducting assessment of the participants.", sesudah: "Assessed [jumlah] participants." }], cepat: [card], kuat: [card], penutup: "Penutup." },
        bagian5: { tafsiran_target: "", pembuka: "Arah 1–3 mengikuti keinginanmu.", arah: ids.map((id) => ({ role_id: id, label: "Siap dilamar saat lulus", fungsi: "Fungsi", dibutuhkan: "A · B · C", dimiliki: "Punya", kenapa: "Kenapa", hari: "Hari", menantang: "Menantang", jalur: "Analyst → Specialist → Manager", industri_dekat: "BUMN", industri_alternatif: "Konsultan", disiapkan: "Siapkan" })), penghubung: "Penghubung.", kurang_cocok: "Payroll.", tempat: [{ nama: "BUMN", cocok: "Paling cocok", isi: "Isi" }], ciri_betah: ["Jam kerja jelas"], kata_cocok: ["talent management"], kata_tanya: ["lembur rutin"] },
        bagian6: { langkah: ["Ubah ringkasan CV.", "Tulis ulang proyek.", "Ngobrol dengan satu orang."], soal_hasil: "Polanya cukup bisa dipegang.", penutup: "Ini potret hari ini, bukan garis finis." },
      },
      paidStatus: "ready",
      level: "entry",
      target: "Mengembangkan SDM di perusahaan",
      arah: ids.map((id, i) => ({ no: i + 1, role: roleById(id)!, group: i < 3 ? "keinginan" : "terbentuk", data: { role_id: id, label: "Siap dilamar", fungsi: "Memetakan kompetensi", dibutuhkan: "A · B", dimiliki: "Punya", kenapa: "Kenapa", hari: "Hari", menantang: "Menantang", jalur: "Analyst → Manager", industri_dekat: "BUMN", industri_alternatif: "Konsultan", disiapkan: "Siapkan" } })),
      identitas: "S1 Teknik Sistem dan Industri ITS",
    };
    const pdf = await renderReportPdf(peta as never, "Ailsa");
    fs.writeFileSync(`${OUT}/peta.pdf`, pdf);
    const cv = emptyBuiltCv();
    cv.diri = { nama: "Rani Putri", kota: "Surabaya, Jawa Timur", hp: "+62 812-3456-7890", email: "rani@email.com", linkedin: "" };
    cv.pendidikan = { gelar: "S1 Administrasi Bisnis", kampus: "Universitas Airlangga", kota: "Surabaya", lulus: "2025", ipk: "3,51" };
    cv.org = [{ peran: "Bendahara", nama: "BEM FISIP", mulai: "Feb 2023", selesai: "Jan 2024", bullets: [{ tugas: "mengelola kas organisasi", jumlah: "Rp40 juta per tahun", hasil: "laporan tepat waktu 12 bulan berturut-turut" }] }];
    cv.keahlian = ["Excel (PivotTable)", "Canva"];
    cv.profil = "Lulusan S1 Administrasi Bisnis Universitas Airlangga — terbiasa mengelola keuangan organisasi.";
    fs.writeFileSync(`${OUT}/cv.pdf`, await renderCvPdf(cv));
    expect(pdf.length).toBeGreaterThan(10000);
  }, 60000);
});
