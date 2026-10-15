import Link from "next/link";
import { SECTIONS } from "@/lib/config";
import { GROUP_LABEL } from "@/lib/groups";
import { SALARY_LABELS, SALARY_NOTE } from "@/lib/roles";
import type { Peta, Arah } from "@/lib/peta";
import type { CareerType, PaidPart } from "@/lib/report-schema";

export function SectionHead({ no }: { no: number }) {
  const s = SECTIONS[no - 1];
  return (
    <div className="stack" style={{ ["--gap" as string]: "4px" }}>
      <span className="caption" style={{ color: s.warna, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>
        Bagian {no} dari 6
      </span>
      <h1>{s.nama}</h1>
      <p className="muted">{s.sub}</p>
    </div>
  );
}

// Bagian 1 — gratis (AC-A2.1). Tidak ada grafik batang (AC-A3.4).
export function Bagian1({ peta, nickname }: { peta: Peta; nickname: string }) {
  const a = peta.archetype;
  const f = peta.free;
  return (
    <div className="stack" style={{ ["--gap" as string]: "18px" }}>
      <SectionHead no={1} />
      <section className="arke" style={{ background: a.warna }}>
        <span className="t">Cara kerja kamu</span>
        <h2>
          {a.nama}
          <small>{f.julukan_sub}</small>
        </h2>
        <p>{f.cara_kerja}</p>
        <span className="caption" style={{ color: "rgba(255,255,255,.8)" }}>{nickname}{peta.identitas ? ` · ${peta.identitas}` : ""}</span>
      </section>

      <section className="stack" style={{ ["--gap" as string]: "10px" }}>
        <h2>Yang paling kamu banget</h2>
        {f.paling.map((p, i) => (
          <div key={i} className="pcard">
            <span className="num" style={{ background: "var(--sky)" }}>{i + 1}</span>
            <div>
              <h3>{p.judul}</h3>
              <span className="evid">{p.chip}</span>
              <p className="muted" style={{ marginTop: 6 }}>{p.isi}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="stack" style={{ ["--gap" as string]: "10px" }}>
        <h2>Yang masih perlu dilatih</h2>
        {f.dilatih.map((p, i) => (
          <div key={i} className="pcard" style={{ background: "#fffdf3", borderColor: "#fde68a" }}>
            <span className="num" style={{ background: "#CCA700" }}>{i + 1}</span>
            <div>
              <h3>{p.judul}</h3>
              <p className="muted" style={{ marginTop: 4 }}>{p.isi}</p>
            </div>
          </div>
        ))}
        <p className="sorot">{f.catatan_kolom}</p>
      </section>

      <section className="panel soft stack" style={{ ["--gap" as string]: "10px" }}>
        <h2>Yang cara kerjanya mirip kamu</h2>
        <div className="card">
          <span className="tag tag-sky">Tokoh terkenal</span>
          <h3 style={{ marginTop: 6 }}>{a.tokoh.nama} <span className="caption">· {a.tokoh.peran}</span></h3>
          <p className="muted">{a.tokoh.why}</p>
        </div>
        <div className="card">
          <span className="tag tag-purple">Tokoh fiksi</span>
          <h3 style={{ marginTop: 6 }}>{a.fiksi.nama} <span className="caption">· {a.fiksi.asal}</span></h3>
          <p className="muted">{a.fiksi.why}</p>
        </div>
        <p className="caption">Nama di atas cuma perbandingan cara kerja, bukan tanda mereka kenal atau mendukung Nawasena.</p>
      </section>
    </div>
  );
}

const TYPE_INFO: Record<CareerType, [string, string, string]> = {
  I: ["I-shape", "Spesialis murni", "Sangat dalam di satu bidang dan jarang keluar dari situ."],
  Generalis: ["Generalis", "Paham banyak bidang", "Paham banyak bidang, tapi belum dalam di satu pun. Wajar di awal karir."],
  T: ["T-shape", "Spesialis yang nyambung", "Dalam di satu bidang, dan paham bidang di sekitarnya."],
  V: ["V-shape", "Spesialis yang melebar", "Dalam di satu bidang, lalu keahliannya merembet ke bidang sebelah."],
  Pi: ["π-shape", "Dua keahlian", "Dalam di dua bidang sekaligus."],
  M: ["M-shape", "Banyak keahlian", "Dalam di tiga bidang atau lebih."],
  X: ["X-shape", "Spesialis yang memimpin", "Keahlian seperti T, ditambah kemampuan menyatukan orang ke satu arah."],
};

export function Bagian2({ p }: { p: PaidPart["bagian2"] }) {
  return (
    <div className="stack" style={{ ["--gap" as string]: "18px" }}>
      <SectionHead no={2} />
      <p>Di dunia kerja, tipe karir sering digambarkan dengan huruf. Garis tegak artinya keahlian di satu bidang. Garis mendatar artinya keluasan, yaitu seberapa banyak bidang lain yang kamu pahami. Tidak ada tipe yang paling bagus. Yang penting, kamu tahu sedang membangun yang mana.</p>
      <div className="types">
        {(Object.keys(TYPE_INFO) as (keyof typeof TYPE_INFO)[]).map((k) => {
          const [nama, sub, desc] = TYPE_INFO[k];
          const on = k === p.tipe_sekarang;
          const go = k === p.tipe_dituju && !on;
          return (
            <div key={k} className={`type${on ? " on" : go ? " go" : ""}`}>
              {on ? <span className="tag tag-sky">Kamu sekarang</span> : go ? <span className="tag tag-sun">Sedang dituju</span> : null}
              <h3 style={{ marginTop: 4 }}>{nama}</h3>
              <p className="caption">{sub}</p>
              <p style={{ fontSize: 12, lineHeight: "17px", marginTop: 4 }}>{desc}</p>
            </div>
          );
        })}
      </div>
      <section className="panel stack" style={{ background: "#044E6E", color: "#e6f3f9", borderColor: "#044E6E", ["--gap" as string]: "10px" }}>
        <span className="caption" style={{ color: "#7fc8e8", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em" }}>Tipe karirmu sekarang</span>
        <h2 style={{ color: "#fff" }}>{p.judul}</h2>
        <p>{p.penjelasan}</p>
        <dl className="kv">
          <dt style={{ color: "#ffcb05" }}>Keahlian</dt><dd>{p.keahlian}</dd>
          <dt style={{ color: "#ffcb05" }}>Keluasan</dt><dd>{p.keluasan}</dd>
          <dt style={{ color: "#ffcb05" }}>Sinyal memimpin</dt><dd>{p.sinyal_memimpin}</dd>
        </dl>
      </section>
      <section className="stack" style={{ ["--gap" as string]: "10px" }}>
        <h2>Dua jalan dari sini</h2>
        {p.jalan.map((j, i) => (
          <div key={i} className="card">
            <h3>{j.judul}</h3>
            <p className="muted">{j.isi}</p>
            <p className="caption" style={{ color: "var(--blue)", fontWeight: 800, marginTop: 6 }}>{j.rujukan}</p>
          </div>
        ))}
      </section>
      <p className="sorot">{p.catatan}</p>
    </div>
  );
}

export function Bagian3({ p }: { p: PaidPart["bagian3"] }) {
  return (
    <div className="stack" style={{ ["--gap" as string]: "18px" }}>
      <SectionHead no={3} />
      <div className="tiles">
        {p.ubin.map((u, i) => (
          <div key={i} className="tile"><b>{u.angka}</b><span className="caption">{u.label}</span></div>
        ))}
      </div>
      <section className="stack" style={{ ["--gap" as string]: "10px" }}>
        <h2>Yang lagi jadi keunggulanmu</h2>
        {p.keunggulan.map((k, i) => (
          <div key={i} className="pcard"><span className="num" style={{ background: "var(--success)" }}>{i + 1}</span><div><h3>{k.judul}</h3><p className="muted">{k.isi}</p></div></div>
        ))}
      </section>
      <section className="stack" style={{ ["--gap" as string]: "10px" }}>
        <h2>Yang bisa jadi tantangan</h2>
        {p.tantangan.map((k, i) => (
          <div key={i} className="pcard"><span className="num" style={{ background: "#CCA700" }}>{i + 1}</span><div><h3>{k.judul}</h3><p className="muted">{k.isi}</p></div></div>
        ))}
        <p className="sorot">{p.penutup}</p>
      </section>
      <section className="panel stack" style={{ background: "#FFFAF6", borderColor: "#F5D3BE", ["--gap" as string]: "12px" }}>
        <div className="row between"><h2>Perkenalan 60 detik</h2><span className="tag tag-sun">Kalau diminta cerita soal diri</span></div>
        {([["Siapa kamu", p.cerita60.siapa], ["Buktinya", p.cerita60.bukti], ["Kenapa arah ini", p.cerita60.kenapa]] as const).map(([l, t], i) => (
          <div key={l} className="row" style={{ alignItems: "flex-start" }}>
            <span className="num" style={{ background: "#E07A3F" }}>{i + 1}</span>
            <div><span className="caption" style={{ color: "#B25A26", fontWeight: 800, textTransform: "uppercase" }}>{l}</span><p>{t}</p></div>
          </div>
        ))}
        <p className="caption">Ditulis pakai saya, karena ini yang kamu ucapkan ke pewawancara. Tidak perlu dihafal kata per kata. Cukup ingat urutannya.</p>
      </section>
      <section className="stack" style={{ ["--gap" as string]: "10px" }}>
        <h2>Tiga pertanyaan yang paling mungkin muncul</h2>
        <p className="muted">{p.pertanyaan_untuk}</p>
        {p.pertanyaan.map((q, i) => (
          <div key={i} className="card stack" style={{ ["--gap" as string]: "8px" }}>
            <div className="row" style={{ alignItems: "flex-start" }}><span className="num" style={{ background: "#044E6E" }}>{i + 1}</span><h3>{q.tanya}</h3></div>
            <dl className="kv">
              <dt>Yang sebenarnya dicek</dt><dd>{q.dicek}</dd>
              <dt style={{ color: "var(--success)" }}>Cerita yang bisa kamu pakai</dt><dd>{q.cerita}</dd>
              <dt style={{ color: "#B25A26" }}>Yang biasanya kurang kuat</dt><dd>{q.kurang_kuat}</dd>
            </dl>
          </div>
        ))}
      </section>
    </div>
  );
}

export function Bagian4({ p }: { p: PaidPart["bagian4"] }) {
  return (
    <div className="stack" style={{ ["--gap" as string]: "18px" }}>
      <SectionHead no={4} />
      <p>{p.pembuka}</p>
      <section className="stack" style={{ ["--gap" as string]: "10px" }}>
        <h2>Kelihatan bedanya kalau disandingkan</h2>
        {p.banding.map((b, i) => (
          <div key={i} className="bs">
            <div className="s"><span className="caption">Ditulis gini</span><p>{b.sebelum}</p></div>
            <div className="d"><span className="caption">Jadikan gini</span><p>{b.sesudah}</p></div>
          </div>
        ))}
      </section>
      <section className="stack" style={{ ["--gap" as string]: "10px" }}>
        <h2>Yang paling cepat terasa efeknya</h2>
        {p.cepat.map((k, i) => (
          <div key={i} className="pcard"><span className="num" style={{ background: "#CCA700" }}>{i + 1}</span><div><h3>{k.judul}</h3><p className="muted">{k.isi}</p></div></div>
        ))}
      </section>
      <section className="stack" style={{ ["--gap" as string]: "10px" }}>
        <h2>Yang bisa bikin CV-mu makin kuat</h2>
        {p.kuat.map((k, i) => (
          <div key={i} className="pcard"><span className="num" style={{ background: "var(--blue)" }}>{i + 1}</span><div><h3>{k.judul}</h3><p className="muted">{k.isi}</p></div></div>
        ))}
      </section>
      <p className="sorot">{p.penutup}</p>
    </div>
  );
}

function groupTitle(g: Arah["group"], first: Arah[]) {
  if (!g) return null;
  const nos = first.filter((a) => a.group === g).map((a) => a.no);
  const range = nos.length > 1 ? `Arah ${nos[0]}–${nos[nos.length - 1]}` : `Arah ${nos[0]}`;
  return `${GROUP_LABEL[g]} · ${range}`;
}

export function Bagian5({ peta }: { peta: Peta }) {
  const p = peta.paid!.bagian5;
  const groups: Arah["group"][] = [];
  peta.arah.forEach((a) => { if (!groups.includes(a.group)) groups.push(a.group); });
  return (
    <div className="stack" style={{ ["--gap" as string]: "18px" }}>
      <SectionHead no={5} />
      {peta.target ? (
        <div className="card" style={{ background: "#FFF6EE", borderColor: "#F6D9C2" }}>
          <span className="caption" style={{ color: "#B4561F", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em" }}>
            {peta.level === "entry" ? "Pekerjaan yang kamu bayangkan" : "Target karirmu"}
          </span>
          <p style={{ fontWeight: 600, color: "var(--ink)", marginTop: 4 }}>{peta.target}</p>
        </div>
      ) : null}
      {p.tafsiran_target ? <p className="muted">{p.tafsiran_target}</p> : null}
      <p>{p.pembuka}</p>
      {groups.map((g) => (
        <section key={String(g)} className="stack" style={{ ["--gap" as string]: "8px" }}>
          {g ? <h3>{groupTitle(g, peta.arah)}</h3> : null}
          {peta.arah.filter((a) => a.group === g).map((a) => (
            <Link key={a.no} href={`/peta/5/${a.no}`} className="lock-row">
              <span className="num" style={{ background: "#044E6E" }}>{a.no}</span>
              <div className="grow">
                <h3>{a.role.nama}</h3>
                <p className="caption">{a.role.rumpun}</p>
              </div>
              <span className="tag tag-sky">{a.data.label}</span>
            </Link>
          ))}
        </section>
      ))}
      <section className="card soft stack" style={{ ["--gap" as string]: "6px" }}>
        <h3>Yang menghubungkan keenamnya</h3>
        <p>{p.penghubung}</p>
      </section>
      <section className="card stack" style={{ ["--gap" as string]: "6px" }}>
        <h3>Yang mungkin kurang cocok</h3>
        <p className="muted">{p.kurang_cocok}</p>
      </section>
      <section className="stack" style={{ ["--gap" as string]: "10px" }}>
        <h2>Tempat kerja yang paling pas buat kamu</h2>
        {p.tempat.map((t, i) => (
          <div key={i} className="card">
            <div className="row between"><h3>{t.nama}</h3><span className={`tag ${t.cocok === "Paling cocok" ? "tag-ok" : t.cocok === "Cocok" ? "tag-sky" : "tag-sun"}`}>{t.cocok}</span></div>
            <p className="muted" style={{ marginTop: 4 }}>{t.isi}</p>
          </div>
        ))}
        <h3>Ciri tempat yang bikin kamu betah</h3>
        <div className="row wrap">{p.ciri_betah.map((c) => <span key={c} className="chip">{c}</span>)}</div>
        <h3>Kata di lowongan kerja yang perlu kamu perhatikan</h3>
        <p className="caption">Tanda cocok</p>
        <div className="row wrap">{p.kata_cocok.map((c) => <span key={c} className="chip on">{c}</span>)}</div>
        <p className="caption">Bisa kamu tanyakan saat wawancara</p>
        <div className="row wrap">{p.kata_tanya.map((c) => <span key={c} className="chip">{c}</span>)}</div>
        <p className="caption">Kata di baris kedua bukan tanda untuk mundur. Kamu bisa menanyakan contoh nyatanya, lalu menilai sendiri apakah ritmenya cocok buat kamu.</p>
      </section>
    </div>
  );
}

export function ArahDetail({ a }: { a: Arah }) {
  const d = a.data;
  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <span className="caption" style={{ fontWeight: 800 }}>
        Arah {a.no} dari 6{a.group ? ` · ${GROUP_LABEL[a.group]}` : ""} · {a.role.rumpun}
      </span>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <span className="num" style={{ background: "#044E6E", width: 40, height: 40 }}>{a.no}</span>
        <div>
          <h1>{a.role.nama}</h1>
          <p className="muted">{d.fungsi}</p>
        </div>
      </div>
      <div className="row wrap" style={{ alignItems: "stretch" }}>
        <div className="card soft grow" style={{ minWidth: 220 }}><dt className="caption" style={{ fontWeight: 800, color: "var(--blue)" }}>YANG DIBUTUHKAN DI PEKERJAAN INI</dt><p>{d.dibutuhkan}</p></div>
        <div className="card soft grow" style={{ minWidth: 220 }}><dt className="caption" style={{ fontWeight: 800, color: "var(--blue)" }}>YANG SUDAH KAMU PUNYA</dt><p>{d.dimiliki}</p></div>
      </div>
      <dl className="kv">
        <dt>Kenapa ini cocok buat kamu</dt><dd>{d.kenapa}</dd>
        <dt>Hari-harinya seperti apa</dt><dd>{d.hari}</dd>
        <dt>Bagian yang bakal menantang</dt><dd>{d.menantang}</dd>
        <dt>Jalur karir</dt><dd>{d.jalur}</dd>
      </dl>
      <section className="card stack" style={{ ["--gap" as string]: "6px" }}>
        <h3>Kisaran gaji per bulan</h3>
        {a.role.gaji.map((g, i) => (
          <div key={i} className="row between"><span>{String.fromCharCode(97 + i)}. {SALARY_LABELS[i]}</span><b>Rp{g} juta</b></div>
        ))}
        <p className="caption">{SALARY_NOTE}</p>
      </section>
      <dl className="kv">
        <dt>Industri yang bisa kamu tuju</dt>
        <dd><b>Paling dekat:</b> {d.industri_dekat}<br /><b>Alternatif:</b> {d.industri_alternatif}</dd>
        <dt>Yang perlu kamu siapkan</dt><dd>{d.disiapkan}</dd>
      </dl>
    </div>
  );
}

export function Bagian6Body({ p }: { p: PaidPart["bagian6"] }) {
  return (
    <div className="stack" style={{ ["--gap" as string]: "18px" }}>
      <SectionHead no={6} />
      {p.langkah.map((l, i) => (
        <div key={i} className="pcard"><span className="num" style={{ background: "var(--sky)" }}>{i + 1}</span><p>{l}</p></div>
      ))}
      <section className="card stack" style={{ ["--gap" as string]: "6px" }}>
        <h3>Yang perlu kamu tahu soal hasil ini</h3>
        <p className="muted">{p.soal_hasil}</p>
      </section>
      <p className="sorot">{p.penutup}</p>
    </div>
  );
}
