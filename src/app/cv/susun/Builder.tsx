"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { composeBullet, draftProfile, type Bullet, type BuiltCv } from "@/lib/cv-text";
import { saveBuilder } from "../actions";
import { track } from "@/components/track";

const STEPS = [
  { judul: "Data diri", sub: "Bagian paling atas CV kamu. Sistem penyaring lamaran membaca ini duluan.", opsional: false },
  { judul: "Pendidikan", sub: "Buat kamu yang baru mulai, bagian ini naik ke atas CV — jadi kami tanya lebih awal.", opsional: false },
  { judul: "Pengalaman kerja atau magang", sub: "Kalau belum pernah, lewati saja — bagian berikutnya yang lebih bicara buat kamu.", opsional: true },
  { judul: "Proyek dan organisasi", sub: "Buat kamu yang baru mulai, ini bagian yang paling bicara. Isi satu saja sudah cukup.", opsional: false },
  { judul: "Keahlian", sub: "Keahlian yang bisa diperiksa orang lebih meyakinkan daripada kata umum seperti Kerja Sama Tim.", opsional: false },
  { judul: "Sertifikasi dan pelatihan", sub: "Punya sertifikat kursus, bootcamp, atau pelatihan? Tulis di sini.", opsional: true },
  { judul: "Profil singkat", sub: "Bagian ini kami yang tulis dari isian kamu tadi. Tinggal diperiksa.", opsional: false },
];

const emptyBullet = (): Bullet => ({ tugas: "", jumlah: "", hasil: "" });

export function Builder({ initial, initialStep }: { initial: BuiltCv; initialStep: number }) {
  const [cv, setCv] = useState<BuiltCv>(initial);
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 1), 7));
  const [pending, start] = useTransition();
  const router = useRouter();
  const s = STEPS[step - 1];

  useEffect(() => {
    track("cv_builder_step_view", { langkah: step });
  }, [step]);

  useEffect(() => {
    const onLeave = () => track("cv_builder_abandon", { langkah: step });
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [step]);

  const valid = (() => {
    switch (step) {
      case 1: return !!(cv.diri.nama && cv.diri.kota && cv.diri.hp && cv.diri.email);
      case 2: return !!(cv.pendidikan.gelar && cv.pendidikan.kampus && cv.pendidikan.lulus);
      case 4: return cv.org.length > 0 && !!cv.org[0].peran && !!cv.org[0].nama && !!cv.org[0].bullets[0]?.tugas;
      case 5: return cv.keahlian.length > 0;
      case 7: return cv.profil.trim().length > 20;
      default: return true;
    }
  })();

  function go(next: number, data = cv) {
    start(async () => {
      const res = await saveBuilder(next, data);
      if (res && "profil" in res && typeof res.profil === "string") setCv((c) => ({ ...c, profil: res.profil as string }));
      if (next > 7) router.push("/cv/pratinjau");
      else setStep(next);
      window.scrollTo({ top: 0 });
    });
  }

  function skip() {
    const data = step === 3 ? { ...cv, kerja: [] } : step === 6 ? { ...cv, sertifikasi: [] } : cv;
    setCv(data);
    go(step + 1, data);
  }

  function next() {
    let data = cv;
    if (step === 6 && !cv.profil.trim()) data = { ...cv, profil: draftProfile(cv) };
    setCv(data);
    go(step + 1, data);
  }

  return (
    <div className="stack">
      <div className="stack" style={{ ["--gap" as string]: "8px" }}>
        <div className="row between">
          <span className="caption">Langkah {step} dari 7</span>
          {s.opsional ? <span className="tag tag-gray">Opsional</span> : null}
        </div>
        <div className="progress" aria-hidden><i style={{ width: `${(step / 7) * 100}%` }} /></div>
        <h1>{s.judul}</h1>
        <p className="muted">{s.sub}</p>
      </div>

      {step === 1 && (
        <Fields
          values={cv.diri}
          onChange={(diri) => setCv({ ...cv, diri })}
          fields={[
            ["nama", "Nama lengkap", "Alif Wahyu Rodiansyah", ""],
            ["kota", "Kota, Provinsi", "Surabaya, Jawa Timur", ""],
            ["hp", "Nomor HP", "+62 812-3456-7890", "Pakai awalan +62, bukan 08 — lebih aman terbaca sistem"],
            ["email", "Email", "alif.wahyu@email.com", "Email yang memuat namamu terlihat lebih profesional daripada nama panggilan"],
            ["linkedin", "LinkedIn", "linkedin.com/in/alifwahyu", "Boleh dikosongi"],
          ]}
        />
      )}
      {step === 2 && (
        <Fields
          values={cv.pendidikan}
          onChange={(pendidikan) => setCv({ ...cv, pendidikan })}
          fields={[
            ["gelar", "Gelar dan jurusan", "S1 Teknik Industri", ""],
            ["kampus", "Nama kampus", "Institut Teknologi Sepuluh Nopember", ""],
            ["kota", "Kota kampus", "Surabaya", ""],
            ["lulus", "Tahun lulus", "2026", ""],
            ["ipk", "IPK", "3,52", "Tulis kalau di atas 3,25. Kalau di bawah, kosongkan saja."],
          ]}
        />
      )}
      {step === 3 && (
        <Entries
          kind="kerja"
          items={cv.kerja.map((k) => ({ a: k.posisi, b: k.tempat, mulai: k.mulai, selesai: k.selesai, bullets: k.bullets }))}
          labels={["Posisi", "Perusahaan", "Staf Administrasi (Magang)", "PT Surya Abadi"]}
          onChange={(xs) => setCv({ ...cv, kerja: xs.map((x) => ({ posisi: x.a, tempat: x.b, mulai: x.mulai, selesai: x.selesai, bullets: x.bullets })) })}
        />
      )}
      {step === 4 && (
        <Entries
          kind="org"
          items={cv.org.map((k) => ({ a: k.peran, b: k.nama, mulai: k.mulai, selesai: k.selesai, bullets: k.bullets }))}
          labels={["Peranmu", "Nama proyek atau organisasi", "Koordinator Konten", "Himpunan Mahasiswa Teknik Industri"]}
          onChange={(xs) => setCv({ ...cv, org: xs.map((x) => ({ peran: x.a, nama: x.b, mulai: x.mulai, selesai: x.selesai, bullets: x.bullets })) })}
        />
      )}
      {step === 5 && <Skills value={cv.keahlian} onChange={(keahlian) => setCv({ ...cv, keahlian })} />}
      {step === 6 && (
        <Certs value={cv.sertifikasi} onChange={(sertifikasi) => setCv({ ...cv, sertifikasi })} />
      )}
      {step === 7 && (
        <label className="field">
          Profil singkat
          <span className="caption help">Sudah kami draf dari isianmu. Ubah bagian yang kurang pas.</span>
          <textarea rows={6} value={cv.profil} onChange={(e) => setCv({ ...cv, profil: e.target.value })} />
        </label>
      )}

      <div className="stack" style={{ ["--gap" as string]: "8px" }}>
        <button className="btn btn-primary btn-block" disabled={!valid || pending} onClick={next}>
          {pending ? "Menyimpan..." : step === 7 ? "Lihat CV-ku" : "Lanjut"}
        </button>
        {s.opsional ? (
          <button className="btn btn-ghost" onClick={skip} disabled={pending}>Lewati langkah ini</button>
        ) : null}
        {step > 1 ? (
          <button className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={pending}>Kembali</button>
        ) : null}
      </div>
    </div>
  );
}

function Fields<T extends Record<string, string>>({
  values,
  onChange,
  fields,
}: {
  values: T;
  onChange: (v: T) => void;
  fields: [keyof T & string, string, string, string][];
}) {
  return (
    <div className="stack">
      {fields.map(([k, label, ph, help]) => (
        <label key={k} className="field">
          {label}
          {help ? <span className="caption help">{help}</span> : null}
          <input type="text" placeholder={ph} value={values[k] ?? ""} onChange={(e) => onChange({ ...values, [k]: e.target.value })} />
        </label>
      ))}
    </div>
  );
}

interface Entry { a: string; b: string; mulai: string; selesai: string; bullets: Bullet[] }

function Entries({ kind, items, labels, onChange }: { kind: string; items: Entry[]; labels: [string, string, string, string]; onChange: (xs: Entry[]) => void }) {
  const list = items.length ? items : [{ a: "", b: "", mulai: "", selesai: "", bullets: [emptyBullet()] }];
  const upd = (i: number, e: Entry) => onChange(list.map((x, j) => (j === i ? e : x)));
  return (
    <div className="stack">
      {list.map((e, i) => (
        <div key={`${kind}-${i}`} className="card stack">
          <label className="field">{labels[0]}<input type="text" placeholder={labels[2]} value={e.a} onChange={(ev) => upd(i, { ...e, a: ev.target.value })} /></label>
          <label className="field">{labels[1]}<input type="text" placeholder={labels[3]} value={e.b} onChange={(ev) => upd(i, { ...e, b: ev.target.value })} /></label>
          <div className="row">
            <label className="field grow">Mulai<input type="text" placeholder="Feb 2025" value={e.mulai} onChange={(ev) => upd(i, { ...e, mulai: ev.target.value })} /></label>
            <label className="field grow">Selesai<input type="text" placeholder="Kosongkan kalau masih" value={e.selesai} onChange={(ev) => upd(i, { ...e, selesai: ev.target.value })} /></label>
          </div>
          {e.bullets.map((b, bi) => (
            <BulletComposer
              key={bi}
              value={b}
              onChange={(nb) => upd(i, { ...e, bullets: e.bullets.map((x, k) => (k === bi ? nb : x)) })}
            />
          ))}
          {e.bullets.length < 3 ? (
            <button type="button" className="btn btn-ghost" onClick={() => upd(i, { ...e, bullets: [...e.bullets, emptyBullet()] })}>+ Tambah satu hal lagi yang kamu kerjakan</button>
          ) : null}
          {list.length > 1 ? (
            <button type="button" className="btn btn-ghost" onClick={() => onChange(list.filter((_, j) => j !== i))}>Hapus ini</button>
          ) : null}
        </div>
      ))}
      <button type="button" className="btn btn-secondary" onClick={() => onChange([...list, { a: "", b: "", mulai: "", selesai: "", bullets: [emptyBullet()] }])}>
        + Tambah {kind === "kerja" ? "pengalaman" : "proyek atau organisasi"}
      </button>
    </div>
  );
}

// Tiga isian sederhana, kalimat ATS dirangkai langsung di layar (AC-E3.3, AC-E3.4).
function BulletComposer({ value, onChange }: { value: Bullet; onChange: (b: Bullet) => void }) {
  const live = composeBullet(value);
  return (
    <div className="stack soft card" style={{ ["--gap" as string]: "10px" }}>
      <label className="field">Tugasnya apa?<input type="text" placeholder="Mengelola akun Instagram himpunan" value={value.tugas} onChange={(e) => onChange({ ...value, tugas: e.target.value })} /></label>
      <label className="field">Berapa banyak atau berapa lama?<input type="text" placeholder="4 unggahan per minggu selama 12 bulan" value={value.jumlah} onChange={(e) => onChange({ ...value, jumlah: e.target.value })} /></label>
      <label className="field">Hasilnya apa?<input type="text" placeholder="menaikkan pengikut dari 800 ke 2.100" value={value.hasil} onChange={(e) => onChange({ ...value, hasil: e.target.value })} /></label>
      <div aria-live="polite">
        <span className="caption">Jadinya di CV:</span>
        <p style={{ fontWeight: 600, color: live ? "var(--ink)" : "var(--caption)" }}>{live || "Kalimatmu muncul di sini begitu kamu mengetik."}</p>
      </div>
    </div>
  );
}

function Skills({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft.split(",").map((x) => x.trim()).filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))]);
    setDraft("");
  };
  return (
    <div className="stack">
      <label className="field">
        Tambah keahlian
        <span className="caption help">Nama alat, metode, atau bahasa. Contoh: Excel (PivotTable), SQL dasar, Figma, Canva, Bahasa Inggris (TOEFL 550)</span>
        <div className="row">
          <input type="text" value={draft} placeholder="Excel lanjutan" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" className="btn btn-secondary" style={{ minHeight: 48 }} onClick={add}>Tambah</button>
        </div>
      </label>
      <div className="row wrap">
        {value.map((k) => (
          <button key={k} type="button" className="chip on" onClick={() => onChange(value.filter((x) => x !== k))} aria-label={`Hapus ${k}`}>{k} ✕</button>
        ))}
      </div>
    </div>
  );
}

function Certs({ value, onChange }: { value: BuiltCv["sertifikasi"]; onChange: (v: BuiltCv["sertifikasi"]) => void }) {
  const list = value.length ? value : [{ nama: "", penerbit: "", tahun: "" }];
  const upd = (i: number, c: BuiltCv["sertifikasi"][number]) => onChange(list.map((x, j) => (j === i ? c : x)));
  return (
    <div className="stack">
      {list.map((c, i) => (
        <div key={i} className="card stack">
          <label className="field">Nama sertifikasi atau pelatihan<input type="text" placeholder="Google Data Analytics" value={c.nama} onChange={(e) => upd(i, { ...c, nama: e.target.value })} /></label>
          <label className="field">Penerbit<input type="text" placeholder="Coursera" value={c.penerbit} onChange={(e) => upd(i, { ...c, penerbit: e.target.value })} /></label>
          <label className="field">Tahun<input type="text" placeholder="2026" value={c.tahun} onChange={(e) => upd(i, { ...c, tahun: e.target.value })} /></label>
        </div>
      ))}
      <button type="button" className="btn btn-secondary" onClick={() => onChange([...list, { nama: "", penerbit: "", tahun: "" }])}>+ Tambah sertifikat</button>
      <p className="caption">Belum punya? Lewati saja. Ini bagian yang paling tidak menentukan di CV.</p>
    </div>
  );
}
