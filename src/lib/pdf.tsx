import "server-only";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { SECTIONS } from "./config";
import { GROUP_LABEL } from "./groups";
import { SALARY_LABELS, SALARY_NOTE } from "./roles";
import type { Peta } from "./peta";
import { composeBullet, type BuiltCv } from "./cv-text";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const PUB = path.join(process.cwd(), "public");
let registered = false;
function fonts() {
  if (registered) return;
  Font.register({
    family: "Jakarta",
    fonts: [
      { src: path.join(FONT_DIR, "plus-jakarta-sans-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "plus-jakarta-sans-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Nunito",
    fonts: [
      { src: path.join(FONT_DIR, "nunito-latin-800-normal.woff"), fontWeight: 800 },
      { src: path.join(FONT_DIR, "nunito-latin-900-normal.woff"), fontWeight: 900 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  registered = true;
}

// Subset font latin tidak memuat → dan π.
const t = (s: string | null | undefined) => (s ?? "").replace(/→/g, "›").replace(/π/g, "Pi");

const C = { blue: "#0284C7", sky: "#009FE3", sun: "#FFD100", ink: "#0F172A", body: "#33505F", muted: "#5D7A88", navy: "#044E6E", line: "#E4ECEF", soft: "#F1F9FD" };

const s = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 48, paddingHorizontal: 44, fontFamily: "Jakarta", fontSize: 10, lineHeight: 1.55, color: C.body },
  foot: { position: "absolute", bottom: 20, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#8CA3AE", borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 6 },
  eyebrow: { fontSize: 8, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: C.sky },
  h1: { fontFamily: "Nunito", fontWeight: 900, fontSize: 22, lineHeight: 1.2, color: C.navy, marginTop: 2 },
  h2: { fontFamily: "Nunito", fontWeight: 800, fontSize: 13.5, lineHeight: 1.3, color: C.navy, marginTop: 14, marginBottom: 6 },
  h3: { fontFamily: "Nunito", fontWeight: 800, fontSize: 11, lineHeight: 1.35, color: C.navy },
  sub: { color: C.muted, marginTop: 2, marginBottom: 10 },
  card: { borderWidth: 0.6, borderColor: C.line, borderRadius: 8, padding: 9, marginBottom: 6 },
  soft: { backgroundColor: C.soft, borderRadius: 8, padding: 10, marginBottom: 6 },
  chip: { fontSize: 7.5, fontWeight: 700, color: "#1C6B45", backgroundColor: "#E3F4EA", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, alignSelf: "flex-start", marginTop: 3 },
  muted: { color: C.muted },
  label: { fontSize: 7.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "#0F7FA8", marginTop: 7 },
  row: { flexDirection: "row" },
  sorot: { borderLeftWidth: 3, borderLeftColor: C.sky, backgroundColor: C.soft, padding: 9, fontWeight: 700, color: C.navy, marginTop: 6 },
});

function Foot({ name }: { name: string }) {
  return (
    <View style={s.foot} fixed>
      <Text>Mengenal Diri dan Arah Karir · {name}</Text>
      <Text render={({ pageNumber }) => `Halaman ${pageNumber}`} />
    </View>
  );
}

function Head({ no }: { no: number }) {
  const sec = SECTIONS[no - 1];
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={[s.eyebrow, { color: sec.warna }]}>Bagian {no} dari 6</Text>
      <Text style={s.h1}>{sec.nama}</Text>
      <Text style={s.sub}>{sec.sub}</Text>
    </View>
  );
}

function Card({ judul, isi, n, chip, warna = C.sky }: { judul: string; isi: string; n?: number; chip?: string; warna?: string }) {
  return (
    <View style={[s.card, s.row]} wrap={false}>
      {n ? (
        <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: warna, marginRight: 8, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontFamily: "Nunito", fontWeight: 900, fontSize: 9 }}>{n}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={s.h3}>{t(judul)}</Text>
        {chip ? <Text style={s.chip}>{t(chip)}</Text> : null}
        <Text style={[s.muted, { marginTop: 2 }]}>{t(isi)}</Text>
      </View>
    </View>
  );
}

const TYPE_NAMES: Record<string, string> = { I: "I-shape", Generalis: "Generalis", T: "T-shape", V: "V-shape", Pi: "Pi-shape", M: "M-shape", X: "X-shape" };

function ReportDoc({ peta, nickname, tanggal }: { peta: Peta; nickname: string; tanggal: string }) {
  const p = peta.paid!;
  const a = peta.archetype;
  const f = peta.free;
  return (
    <Document title={`Peta Potensimu · ${nickname}`} author="Nawasena">
      {/* Sampul (Format v3.3: biru #0284C7, sorotan kuning, daftar isi kartu putih, pita slate) */}
      <Page size="A4" style={{ fontFamily: "Jakarta", backgroundColor: C.blue, color: "#fff" }}>
        <View style={{ paddingTop: 54, paddingHorizontal: 50 }}>
          <Image src={path.join(PUB, "logo-nawasena-putih.png")} style={{ width: 120 }} />
          <Text style={{ marginTop: 46, fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>Peta potensimu</Text>
          <Text style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 30, lineHeight: 1.15, marginTop: 8 }}>Mengenal Dirimu</Text>
          <Text style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 30, lineHeight: 1.15 }}>
            dan <Text style={{ backgroundColor: C.sun, color: C.ink }}> Arah Karirmu </Text>
          </Text>
          <Text style={{ fontFamily: "Nunito", fontWeight: 800, fontSize: 17, lineHeight: 1.3, marginTop: 20 }}>{nickname}</Text>
          <Text style={{ fontSize: 9.5, marginTop: 3 }}>{[peta.identitas, tanggal].filter(Boolean).join(" · ")}</Text>
        </View>
        <View style={{ marginHorizontal: 50, marginTop: 30, backgroundColor: "#fff", borderRadius: 12, padding: 16, color: C.ink }}>
          {SECTIONS.map((sec) => (
            <View key={sec.no} style={[s.row, { marginBottom: 7 }]}>
              <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: sec.warna, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                <Text style={{ color: "#fff", fontFamily: "Nunito", fontWeight: 900, fontSize: 10 }}>{sec.no}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Nunito", fontWeight: 800, fontSize: 10.5 }}>{sec.nama}</Text>
                <Text style={{ fontSize: 7.8, color: "#64748B" }}>{sec.sub}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: C.ink, paddingVertical: 18, paddingHorizontal: 50 }}>
          <Text style={{ fontSize: 8.3, lineHeight: 1.55 }}>
            Disusun dari 36 jawaban kuis yang kamu isi sendiri, dari CV yang kamu kirim{peta.target ? ", dan dari pekerjaan yang kamu bayangkan" : ""}. Isinya untuk membantu kamu mengenali cara kerjamu dan memilih langkah berikutnya, bukan penilaian akhir tentang dirimu.
          </Text>
        </View>
      </Page>

      {/* Bagian 1 */}
      <Page size="A4" style={s.page}>
        <Head no={1} />
        <View style={{ backgroundColor: a.warna, borderRadius: 12, padding: 14, color: "#fff", marginBottom: 8 }} wrap={false}>
          <Text style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase" }}>Cara kerja kamu</Text>
          <Text style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 20, lineHeight: 1.25, marginTop: 3 }}>{a.nama}</Text>
          <Text style={{ fontFamily: "Nunito", fontWeight: 800, fontSize: 12, lineHeight: 1.3 }}>{t(f.julukan_sub)}</Text>
          <Text style={{ marginTop: 6 }}>{t(f.cara_kerja)}</Text>
        </View>
        <Text style={s.h2}>Yang paling kamu banget</Text>
        {f.paling.map((x, i) => <Card key={i} n={i + 1} judul={x.judul} chip={x.chip} isi={x.isi} />)}
        <Text style={s.h2}>Yang masih perlu dilatih</Text>
        {f.dilatih.map((x, i) => <Card key={i} n={i + 1} warna="#CCA700" judul={x.judul} isi={x.isi} />)}
        <Text style={s.sorot}>{t(f.catatan_kolom)}</Text>
        <View style={[s.soft, { marginTop: 10 }]} wrap={false}>
          <Text style={s.h3}>Yang cara kerjanya mirip kamu</Text>
          <Text style={s.label}>Tokoh terkenal</Text>
          <Text><Text style={{ fontWeight: 700 }}>{a.tokoh.nama}</Text> · {a.tokoh.peran}. {a.tokoh.why}</Text>
          <Text style={s.label}>Tokoh fiksi</Text>
          <Text><Text style={{ fontWeight: 700 }}>{a.fiksi.nama}</Text> · {a.fiksi.asal}. {a.fiksi.why}</Text>
          <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 5 }}>Nama di atas cuma perbandingan cara kerja, bukan tanda mereka kenal atau mendukung Nawasena.</Text>
        </View>
        <Foot name={nickname} />
      </Page>

      {/* Bagian 2 */}
      <Page size="A4" style={s.page}>
        <Head no={2} />
        <Text>Garis tegak artinya keahlian di satu bidang. Garis mendatar artinya keluasan. Tidak ada tipe yang paling bagus; yang penting, kamu tahu sedang membangun yang mana.</Text>
        <View style={{ backgroundColor: C.navy, borderRadius: 12, padding: 14, color: "#E6F3F9", marginTop: 10 }} wrap={false}>
          <Text style={{ fontSize: 8, fontWeight: 700, color: "#7FC8E8", letterSpacing: 1.2, textTransform: "uppercase" }}>Tipe karirmu sekarang · {TYPE_NAMES[p.bagian2.tipe_sekarang]} → {TYPE_NAMES[p.bagian2.tipe_dituju]}</Text>
          <Text style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 16, lineHeight: 1.25, color: "#fff", marginTop: 3 }}>{t(p.bagian2.judul)}</Text>
          <Text style={{ marginTop: 5 }}>{t(p.bagian2.penjelasan)}</Text>
          <Text style={[s.label, { color: "#FFCB05" }]}>Keahlian</Text><Text>{t(p.bagian2.keahlian)}</Text>
          <Text style={[s.label, { color: "#FFCB05" }]}>Keluasan</Text><Text>{t(p.bagian2.keluasan)}</Text>
          <Text style={[s.label, { color: "#FFCB05" }]}>Sinyal memimpin</Text><Text>{t(p.bagian2.sinyal_memimpin)}</Text>
        </View>
        <Text style={s.h2}>Dua jalan dari sini</Text>
        {p.bagian2.jalan.map((j, i) => <Card key={i} n={i + 1} judul={j.judul} isi={`${j.isi} ${j.rujukan}.`} />)}
        <Text style={s.sorot}>{t(p.bagian2.catatan)}</Text>
        <Foot name={nickname} />
      </Page>

      {/* Bagian 3 */}
      <Page size="A4" style={s.page}>
        <Head no={3} />
        <View style={[s.row, { gap: 6 }]}>
          {p.bagian3.ubin.map((u, i) => (
            <View key={i} style={[s.soft, { flex: 1 }]}>
              <Text style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 18, lineHeight: 1.25, color: C.blue }}>{t(u.angka)}</Text>
              <Text style={{ fontSize: 8, color: C.muted }}>{t(u.label)}</Text>
            </View>
          ))}
        </View>
        <Text style={s.h2}>Yang lagi jadi keunggulanmu</Text>
        {p.bagian3.keunggulan.map((x, i) => <Card key={i} n={i + 1} warna="#16A34A" judul={x.judul} isi={x.isi} />)}
        <Text style={s.h2}>Yang bisa jadi tantangan</Text>
        {p.bagian3.tantangan.map((x, i) => <Card key={i} n={i + 1} warna="#CCA700" judul={x.judul} isi={x.isi} />)}
        <Text style={s.sorot}>{t(p.bagian3.penutup)}</Text>
        <View break>
          <Text style={s.h2}>Perkenalan 60 detik</Text>
          <Card n={1} warna="#E07A3F" judul="Siapa kamu" isi={p.bagian3.cerita60.siapa} />
          <Card n={2} warna="#E07A3F" judul="Buktinya" isi={p.bagian3.cerita60.bukti} />
          <Card n={3} warna="#E07A3F" judul="Kenapa arah ini" isi={p.bagian3.cerita60.kenapa} />
          <Text style={{ fontSize: 8, color: C.muted }}>Ditulis pakai saya, karena ini yang kamu ucapkan ke pewawancara. Cukup ingat urutannya.</Text>
          <Text style={s.h2}>Tiga pertanyaan yang paling mungkin muncul</Text>
          <Text style={s.muted}>{t(p.bagian3.pertanyaan_untuk)}</Text>
          {p.bagian3.pertanyaan.map((q, i) => (
            <View key={i} style={s.card} wrap={false}>
              <Text style={s.h3}>{i + 1}. {t(q.tanya)}</Text>
              <Text style={s.label}>Yang sebenarnya dicek</Text><Text>{t(q.dicek)}</Text>
              <Text style={[s.label, { color: "#16A34A" }]}>Cerita yang bisa kamu pakai</Text><Text>{t(q.cerita)}</Text>
              <Text style={[s.label, { color: "#B25A26" }]}>Yang biasanya kurang kuat</Text><Text>{t(q.kurang_kuat)}</Text>
            </View>
          ))}
        </View>
        <Foot name={nickname} />
      </Page>

      {/* Bagian 4 */}
      <Page size="A4" style={s.page}>
        <Head no={4} />
        <Text>{t(p.bagian4.pembuka)}</Text>
        <Text style={s.h2}>Kelihatan bedanya kalau disandingkan</Text>
        {p.bagian4.banding.map((b, i) => (
          <View key={i} style={[s.card, { padding: 0 }]} wrap={false}>
            <View style={{ padding: 8, backgroundColor: "#FBFCFD" }}>
              <Text style={{ fontSize: 7.5, color: C.muted }}>Ditulis gini</Text>
              <Text style={{ color: "#93A8B3", textDecoration: "line-through" }}>{t(b.sebelum)}</Text>
            </View>
            <View style={{ padding: 8, backgroundColor: "#F2FAF5" }}>
              <Text style={{ fontSize: 7.5, color: C.muted }}>Jadikan gini</Text>
              <Text style={{ color: "#1C6B45", fontWeight: 700 }}>{t(b.sesudah)}</Text>
            </View>
          </View>
        ))}
        <Text style={s.h2}>Yang paling cepat terasa efeknya</Text>
        {p.bagian4.cepat.map((x, i) => <Card key={i} n={i + 1} warna="#CCA700" judul={x.judul} isi={x.isi} />)}
        <Text style={s.h2}>Yang bisa bikin CV-mu makin kuat</Text>
        {p.bagian4.kuat.map((x, i) => <Card key={i} n={i + 1} warna={C.blue} judul={x.judul} isi={x.isi} />)}
        <Text style={s.sorot}>{t(p.bagian4.penutup)}</Text>
        <Foot name={nickname} />
      </Page>

      {/* Bagian 5: ringkasan */}
      <Page size="A4" style={s.page}>
        <Head no={5} />
        {peta.target ? (
          <View style={{ backgroundColor: "#FFF6EE", borderWidth: 0.6, borderColor: "#F6D9C2", borderRadius: 8, padding: 9, marginBottom: 6 }}>
            <Text style={{ fontSize: 7.5, fontWeight: 700, color: "#B4561F", letterSpacing: 1, textTransform: "uppercase" }}>{peta.level === "entry" ? "Pekerjaan yang kamu bayangkan" : "Target karirmu"}</Text>
            <Text style={{ fontWeight: 700 }}>{t(peta.target)}</Text>
          </View>
        ) : null}
        {p.bagian5.tafsiran_target ? <Text style={s.muted}>{t(p.bagian5.tafsiran_target)}</Text> : null}
        <Text style={{ marginBottom: 6 }}>{t(p.bagian5.pembuka)}</Text>
        {peta.arah.map((r) => (
          <View key={r.no} style={[s.card, s.row]} wrap={false}>
            <Text style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 14, lineHeight: 1.3, color: C.navy, width: 22 }}>{r.no}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.h3}>{r.role.nama}</Text>
              <Text style={{ fontSize: 8, color: C.muted }}>{r.role.rumpun}{r.group ? ` · ${GROUP_LABEL[r.group]}` : ""} · {t(r.data.label)}</Text>
            </View>
          </View>
        ))}
        <Text style={s.h2}>Yang menghubungkan keenamnya</Text>
        <Text>{t(p.bagian5.penghubung)}</Text>
        <Text style={s.h2}>Yang mungkin kurang cocok</Text>
        <Text style={s.muted}>{t(p.bagian5.kurang_cocok)}</Text>
        <Foot name={nickname} />
      </Page>

      {/* Satu halaman per arah */}
      {peta.arah.map((r) => (
        <Page key={r.no} size="A4" style={s.page}>
          <Text style={[s.eyebrow, { color: "#0F7FA8" }]}>Arah {r.no} dari 6{r.group ? ` · ${GROUP_LABEL[r.group]}` : ""} · {r.role.rumpun}</Text>
          <Text style={[s.h1, { fontSize: 19 }]}>{r.role.nama}</Text>
          <Text style={s.sub}>{t(r.data.fungsi)}</Text>
          <View style={[s.row, { gap: 6 }]}>
            <View style={[s.soft, { flex: 1 }]}><Text style={s.label}>Yang dibutuhkan di pekerjaan ini</Text><Text>{t(r.data.dibutuhkan)}</Text></View>
            <View style={[s.soft, { flex: 1 }]}><Text style={s.label}>Yang sudah kamu punya</Text><Text>{t(r.data.dimiliki)}</Text></View>
          </View>
          <Text style={s.label}>Kenapa ini cocok buat kamu</Text><Text>{t(r.data.kenapa)}</Text>
          <Text style={s.label}>Hari-harinya seperti apa</Text><Text>{t(r.data.hari)}</Text>
          <Text style={s.label}>Bagian yang bakal menantang</Text><Text>{t(r.data.menantang)}</Text>
          <Text style={s.label}>Jalur karir</Text><Text>{t(r.data.jalur)}</Text>
          <Text style={s.label}>Kisaran gaji per bulan</Text>
          {r.role.gaji.map((g, i) => <Text key={i}>{String.fromCharCode(97 + i)}. {SALARY_LABELS[i]}: Rp{g} juta</Text>)}
          <Text style={{ fontSize: 7.5, color: "#8CA3AE", marginTop: 3 }}>{SALARY_NOTE}</Text>
          <Text style={s.label}>Industri yang bisa kamu tuju</Text>
          <Text><Text style={{ fontWeight: 700 }}>Paling dekat:</Text> {t(r.data.industri_dekat)}</Text>
          <Text><Text style={{ fontWeight: 700 }}>Alternatif:</Text> {t(r.data.industri_alternatif)}</Text>
          <Text style={s.label}>Yang perlu kamu siapkan</Text><Text>{t(r.data.disiapkan)}</Text>
          <Foot name={nickname} />
        </Page>
      ))}

      {/* Bagian 5 lanjutan: tempat kerja */}
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>Bagian 5 dari 6 · lanjutan</Text>
        <Text style={s.h1}>Tempat kerja yang paling pas buat kamu</Text>
        <View style={{ marginTop: 10 }}>
          {p.bagian5.tempat.map((x, i) => <Card key={i} judul={`${x.nama} · ${x.cocok}`} isi={x.isi} />)}
        </View>
        <Text style={s.h2}>Ciri tempat yang bikin kamu betah</Text>
        {p.bagian5.ciri_betah.map((c, i) => <Text key={i}>• {t(c)}</Text>)}
        <Text style={s.h2}>Kata di lowongan kerja yang perlu kamu perhatikan</Text>
        <Text><Text style={{ fontWeight: 700 }}>Tanda cocok:</Text> {p.bagian5.kata_cocok.map(t).join(" · ")}</Text>
        <Text><Text style={{ fontWeight: 700 }}>Bisa kamu tanyakan saat wawancara:</Text> {p.bagian5.kata_tanya.map(t).join(" · ")}</Text>
        <Foot name={nickname} />
      </Page>

      {/* Bagian 6 */}
      <Page size="A4" style={s.page}>
        <Head no={6} />
        {p.bagian6.langkah.map((l, i) => <Card key={i} n={i + 1} judul={`Langkah ${i + 1}`} isi={l} />)}
        <Text style={s.h2}>Yang perlu kamu tahu soal hasil ini</Text>
        <Text style={s.muted}>{t(p.bagian6.soal_hasil)}</Text>
        <Text style={s.sorot}>{t(p.bagian6.penutup)}</Text>
        <Foot name={nickname} />
      </Page>
    </Document>
  );
}

export async function renderReportPdf(peta: Peta, nickname: string) {
  fonts();
  const tanggal = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  return renderToBuffer(<ReportDoc peta={peta} nickname={nickname} tanggal={tanggal} />);
}

// CV ATS: satu kolom, tanpa tabel, ikon, foto; heading standar; tanpa watermark (AC-E3.7, AC-D1.3).
const cv = StyleSheet.create({
  page: { paddingVertical: 40, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 10.5, lineHeight: 1.4, color: "#111" },
  name: { fontFamily: "Helvetica-Bold", fontSize: 17, lineHeight: 1.3 },
  head: { fontFamily: "Helvetica-Bold", fontSize: 11, lineHeight: 1.3, marginTop: 12, marginBottom: 4, borderBottomWidth: 0.7, borderBottomColor: "#999", paddingBottom: 2 },
  bold: { fontFamily: "Helvetica-Bold" },
});
// Helvetica standar memakai WinAnsi: aman untuk huruf Indonesia, en/em dash, dan titik tengah.

function CvDoc({ data }: { data: BuiltCv }) {
  const d = data.diri;
  const p = data.pendidikan;
  const kerja = data.kerja.filter((k) => k.posisi.trim());
  const org = data.org.filter((o) => o.peran.trim());
  const sert = data.sertifikasi.filter((x) => x.nama.trim());
  return (
    <Document title={`CV ${d.nama}`} author={d.nama}>
      <Page size="A4" style={cv.page}>
        <Text style={cv.name}>{d.nama}</Text>
        <Text>{[d.kota, d.hp, d.email, d.linkedin].filter(Boolean).join(" | ")}</Text>
        {data.profil ? (<><Text style={cv.head}>PROFIL</Text><Text>{t(data.profil)}</Text></>) : null}
        <Text style={cv.head}>PENDIDIKAN</Text>
        <Text style={cv.bold}>{[p.gelar, p.kampus, p.kota].filter(Boolean).join(", ")}</Text>
        <Text>{[p.lulus && `Lulus ${p.lulus}`, p.ipk && `IPK ${p.ipk}/4,00`].filter(Boolean).join(" · ")}</Text>
        {kerja.length ? <Text style={cv.head}>PENGALAMAN KERJA</Text> : null}
        {kerja.map((k, i) => (
          <View key={i} style={{ marginBottom: 6 }} wrap={false}>
            <Text style={cv.bold}>{k.posisi}, {k.tempat}</Text>
            <Text>{k.mulai} – {k.selesai || "sekarang"}</Text>
            {k.bullets.map(composeBullet).filter(Boolean).map((b, j) => <Text key={j}>- {t(b)}</Text>)}
          </View>
        ))}
        {org.length ? <Text style={cv.head}>PROYEK DAN ORGANISASI</Text> : null}
        {org.map((o, i) => (
          <View key={i} style={{ marginBottom: 6 }} wrap={false}>
            <Text style={cv.bold}>{o.peran}, {o.nama}</Text>
            <Text>{o.mulai} – {o.selesai || "sekarang"}</Text>
            {o.bullets.map(composeBullet).filter(Boolean).map((b, j) => <Text key={j}>- {t(b)}</Text>)}
          </View>
        ))}
        {data.keahlian.length ? (<><Text style={cv.head}>KEAHLIAN</Text><Text>{data.keahlian.join(", ")}</Text></>) : null}
        {sert.length ? <Text style={cv.head}>SERTIFIKASI DAN PELATIHAN</Text> : null}
        {sert.map((x, i) => <Text key={i}>- {[x.nama, x.penerbit].filter(Boolean).join(", ")}{x.tahun ? ` (${x.tahun})` : ""}</Text>)}
      </Page>
    </Document>
  );
}

export async function renderCvPdf(data: BuiltCv) {
  return renderToBuffer(<CvDoc data={data} />);
}
