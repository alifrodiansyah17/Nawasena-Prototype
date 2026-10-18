// Panduan penulisan + skema JSON untuk tiap potongan laporan "Mengenal Diri dan Arah Karir" (format v3.5).

export const GAYA = `
Kamu penulis laporan Nawasena — "Sahabat karirmu!". Pembacanya mahasiswa, lulusan baru, dan pekerja Indonesia.
Tulis seperti teman yang jujur memberi saran, bukan penguji.

ATURAN BAHASA (wajib):
- Bahasa Indonesia lisan yang wajar. Kalimat pendek, sapaan "kamu". Hindari bahasa buku teks, klinis, atau terlalu ilmiah.
- Jangan pakai kata kerja berakhiran -in yang dipaksakan (nyelesaiin, mutusin, benerin). Pakai bentuk baku (menyelesaikan, memutuskan).
- Kata sehari-hari Gen-Z boleh kalau memang dipakai orang (badmood, baper, overthinking, daily activity).
- Jangan pakai metafora yang perlu diterjemahkan. Tulis langsung maksudnya.
- Tulis "karir", bukan "karier".
- Jangan menyebut istilah teknis kuis (RIASEC, Big Five, Holland, skor 3–12, konstruk). Pakai bahasa biasa: "minat", "cara kerja", "kuat banget".
- Jangan menulis angka skor kuis dalam bentuk apa pun (mis. "12/12", "skor 9", "nilai 10 dari 12"). Sebut saja "kuat banget", "kuat", atau jumlah jawaban di ujung skala.
- Bahasa CV pengguna (Indonesia atau Inggris) bukan masalah dan tidak perlu dikomentari.
- Jangan memuji berlebihan dan jangan menghakimi. Kelemahan ditulis sebagai hal yang bisa dilatih.

ATURAN ISI (wajib):
- Semua fakta tentang orang ini HANYA dari CV, lampiran, dan jawaban kuis yang diberikan. Jangan mengarang pengalaman, angka, nama perusahaan, atau prestasi.
  Kalau sebuah angka belum ada di CV, tulis tempatnya dengan kurung siku, misalnya [jumlah peserta].
- Jangan menulis nomor HP, WhatsApp, email, atau alamat orang ini di mana pun.
- Setiap klaim tentang cara kerja harus bisa ditelusuri ke jawaban kuis ("3 dari 3 jawaban di ujung skala") atau ke CV.
- Jangan menulis angka gaji di mana pun. Kisaran gaji diisi sistem dari tabel referensi Nawasena.
- Satu orang = satu laporan yang konsisten. Jangan bertentangan dengan bagian lain yang diberikan sebagai konteks.
- Peran di Bagian 5 harus nama pekerjaan yang benar-benar ada di lowongan Indonesia. Tidak boleh ada arah yang dobel.
`;

export const MASKOT = ["analyst", "builder", "spark", "anchor", "voice", "scout"] as const;
export const BENTUK = ["I", "—", "T", "V", "π", "M", "X"] as const;

const s = (d?: string) => (d ? { type: "string", description: d } : { type: "string" });
const obj = (props: Record<string, unknown>) => ({
  type: "object",
  properties: props,
  required: Object.keys(props),
  additionalProperties: false,
});
const arr = (item: unknown, d?: string) => (d ? { type: "array", items: item, description: d } : { type: "array", items: item });
const jp = obj({ j: s("judul satu kalimat pendek"), p: s("penjelasan 1–3 kalimat") });

// ---------------------------------------------------------------- Bagian 1 (gratis)
export function skemaBagian1(idNyata: string[], idFiksi: string[]) {
  return obj({
    tahun_kerja: { type: "number", description: "Lama kerja penuh waktu dari CV, dalam tahun. Magang, organisasi, dan kepanitiaan tidak dihitung. 0 kalau belum bekerja." },
    peran_kini: s("Jabatan pekerjaan penuh waktu saat ini atau yang terakhir, persis/terdekat dengan yang tertulis di CV, mis. 'Product Manager' atau 'Senior Accountant'. Isi '' kalau belum pernah bekerja penuh waktu (magang dan organisasi tidak dihitung)."),
    identitas: s("Satu baris tanpa nama, umur, atau kontak. Sudah bekerja: '<jabatan kini> · <N> tahun pengalaman kerja', mis. 'Product Manager · 4 tahun pengalaman kerja'. Belum bekerja: pendidikan terakhir dan statusnya, mis. 'S1 Teknik Industri ITS · belum bekerja tetap'."),
    arketipe: obj({
      nama: s("Julukan bahasa Inggris dua kata diawali The, mis. 'The Analyst', 'The Conductor', 'The Anchor'"),
      sub: s("Anak judul bahasa Indonesia 2–4 kata, mis. 'Pengurai yang Teliti'"),
      teks: s("Dua kalimat: 'Kamu tipe yang …'. Kalimat kedua: 'Gabungan itu …'"),
      maskot: { type: "string", enum: [...MASKOT], description: "analyst=pengurai/data, builder=membuat/praktis, spark=ide/kreatif, anchor=teliti/bisa diandalkan, voice=orang/komunikasi, scout=penjelajah/hal baru" },
    }),
    paling: arr(obj({ j: s("judul pendek"), c: s("bukti singkat, mis. '3 dari 3 jawaban di ujung skala'"), p: s("2–3 kalimat, kaitkan dengan CV kalau ada") }), "TEPAT 4 butir: hal yang paling kamu banget"),
    dilatih: arr(jp, "TEPAT 3 butir: yang masih perlu dilatih, ditulis tanpa menghakimi"),
    tokoh_nyata: obj({ id: { type: "string", enum: idNyata }, why: s("1–2 kalimat kemiripan CARA KERJA, diawali 'Sama-sama …'. Jangan mengarang kutipan.") }),
    tokoh_fiksi: obj({ id: { type: "string", enum: idFiksi }, why: s("1–2 kalimat kemiripan cara kerja") }),
    kartu_ciri: arr(s(), "3 frasa pendek ciri cara kerja (maks 5 kata)"),
  });
}

export const TUGAS_BAGIAN1 = `
Tugas: tulis BAGIAN 1 "Kenalan Sama Dirimu" (bagian gratis, dibaca langsung setelah kuis).
- arketipe: julukan yang menangkap gabungan 2 hal paling menonjol. Jangan memakai julukan yang terlalu umum.
- paling: 4 hal yang paling kamu banget. Boleh satu butir berupa dua jawaban yang tampak bertabrakan kalau memang ada.
- dilatih: 3 hal yang masih perlu dilatih, dari nilai terendah atau jawaban yang menahan diri.
- tokoh_nyata dan tokoh_fiksi: pilih SATU dari daftar tokoh yang diberikan (pakai id-nya), yang cara kerjanya paling mirip.
- tahun_kerja: baca dari CV. Kalau tanggal tidak lengkap, perkirakan dengan hati-hati.
- peran_kini dan identitas: kalau sudah bekerja penuh waktu, sebut jabatannya dan lama pengalaman kerjanya
  (tahun_kerja dibulatkan; kurang dari 1 tahun ditulis 'kurang dari 1 tahun pengalaman kerja').
`;

// ---------------------------------------------------------------- Rencana: Bagian 2–4 + rencana enam arah
export function skemaRencana(idPeran: string[]) {
  return obj({
    b2: obj({
      kamu: { type: "string", enum: [...BENTUK], description: "tipe karir sekarang" },
      tuju: { type: "string", enum: [...BENTUK], description: "tipe yang sedang dituju (boleh sama dengan kamu kalau sudah matang)" },
      judul: s("mis. 'Generalis, dan sedang menebal jadi T'"),
      teks: s("2–3 kalimat alasan, pakai bukti CV"),
      keahlian: s("bukti keahlian dari CV, 1–2 kalimat"),
      keluasan: s("bukti keluasan dari CV, 1–2 kalimat"),
      memimpin: s("sinyal memimpin dari kuis + CV, 1–2 kalimat"),
      jalan: arr(obj({
        judul: s("mis. 'Menebal jadi T'"),
        bentuk: { type: "string", enum: [...BENTUK], description: "tipe karir yang dituju jalan ini; tidak boleh lebih awal dari 'kamu' (urutan: — → I/T → V/π → M/X)" },
        teks: s("2 kalimat"),
        ref: s("mis. 'Arah 1 dan 3 di Bagian 5'"),
      }), "TEPAT 2 jalan dari sini"),
      catatan: s("'Yang perlu kamu timbang': 1–2 kalimat, TANPA awalan label"),
      contoh: obj({ I: s(), "—": s(), T: s(), V: s(), "π": s(), M: s(), X: s() }),
    }),
    b3: obj({
      ubin: arr(obj({ angka: s("angka singkat dari CV, mis. '3' atau '6 orang' atau '800→2.100'"), label: s("keterangan pendek") }), "TEPAT 3 ubin angka dari CV. Kalau CV hampir tanpa angka, pakai hitungan yang jujur (jumlah organisasi, lama pengalaman)."),
      plus: arr(jp, "TEPAT 2 keunggulan yang sudah bisa ditunjukkan ke perekrut"),
      minus: arr(jp, "TEPAT 2 tantangan"),
      sorot: s("1 kalimat kesimpulan"),
      cerita: obj({ siapa: s("pakai 'saya'"), bukti: s("pakai 'saya', satu bukti terkuat"), kenapa: s("pakai 'saya', kenapa arah nomor 1") }),
      tanya_lead: s("mis. 'Untuk arah nomor 1, Business Analyst.'"),
      tanya: arr(obj({ t: s("pertanyaan wawancara"), cek: s("yang sebenarnya dicek"), pakai: s("cerita dari CV yang bisa dipakai"), kurang: s("yang biasanya kurang kuat") }), "TEPAT 3 pertanyaan; yang ketiga 'Apa kelemahanmu?' dikaitkan ke Bagian 1"),
    }),
    b4: obj({
      pembuka: s("2 kalimat tentang kondisi CV"),
      banding: arr(obj({
        sblm: s("kutipan ASLI dari CV, persis seperti tertulis"),
        sdh: s("versi yang lebih kuat dari kalimat yang SAMA, WAJIB dalam bahasa yang sama dengan sblm (sblm bahasa Inggris → sdh bahasa Inggris); angka yang belum ada ditulis [kurung siku]"),
      }), "TEPAT 2 pasang"),
      segera: arr(jp, "TEPAT 3 yang paling cepat terasa efeknya"),
      kuat: arr(jp, "TEPAT 2 yang bikin CV makin kuat"),
      sorot: s("1 kalimat"),
    }),
    arah: arr(obj({
      nama: s("nama peran, boleh dengan konteks: 'Financial Analyst · Corporate Finance'"),
      fam: s("rumpun pekerjaan singkat"),
      peran_id: { type: "string", enum: idPeran, description: "id peran dari TABEL REFERENSI PERAN yang paling sesuai dengan arah ini. Gaji diambil dari baris ini. Tidak boleh dobel." },
      kel: s("kosongkan '' kalau tidak ada target; kalau ada target isi 'Sesuai keinginanmu' / 'Sudah terbentuk di kamu' / 'Sesuai target karirmu' / 'Relevan dengan karirmu sekarang'"),
      alasan_urut: s("1 kalimat catatan internal kenapa urutan ini"),
    }), "TEPAT 6 arah karir, urut sesuai aturan"),
    b5: obj({
      intro: s("pembuka Bagian 5, 2–3 kalimat; sebut tafsiran target kalau ada"),
      benang: s("'Yang menghubungkan keenamnya', 2 kalimat"),
      kurang: s("'Yang mungkin kurang cocok', 2 kalimat"),
    }),
  });
}

export const TUGAS_RENCANA = `
Tugas: tulis BAGIAN 2 (Tipe Karirmu), BAGIAN 3 (Keunggulan dan Tantanganmu), BAGIAN 4 (Catatan buat CV-mu),
lalu tentukan ENAM ARAH KARIR untuk Bagian 5 beserta pembukanya. Rincian tiap arah ditulis di tahap berikutnya.

Tipe karir: I = spesialis murni, — = generalis, T = spesialis yang nyambung, V = spesialis yang melebar,
π = dua keahlian, M = banyak keahlian, X = spesialis yang memimpin. Keahlian dibaca dari lama dan bukti kerja di satu bidang (CV),
keluasan dari bidang lain + jawaban soal rasa ingin tahu dan hal baru, sinyal memimpin dari jawaban soal mengambil alih + pengalaman memimpin.
contoh: isi contoh pekerjaan untuk tiap tipe yang relevan dengan bidang orang ini (format 'Peneliti, aktuaris, engineer spesialis').

Aturan enam arah:
- Kelompok arah mengikuti JENIS PERTANYAAN TARGET yang dijawab pengguna (lihat data), bukan level CV,
  karena aplikasi sudah menjanjikan pembagian ini ke pengguna sebelum analisis.
- Tanpa target: urutkan dari yang paling banyak memakai bekal yang sudah terbukti (CV + kuis). kel = ''.
- Ada target (jenis PEKERJAAN maupun ROLE): pengguna memilih 1–6 role dari rekomendasi yang disusun dari CV dan kuisnya.
  Arah 1 sampai N mengikuti pilihannya, N = jumlah pilihan (paling banyak 6), satu arah untuk tiap pilihan, urut sesuai pilihan.
  Pilihan berupa nama role umum (mis. 'Business Analyst', 'Product Management'); jadikan role konkret di Indonesia yang pas dengan
  jenjang dan keahliannya di CV. kel arah 1..N: 'Sesuai keinginanmu' (PEKERJAAN) atau 'Sesuai target karirmu' (ROLE).
  Arah sisanya sampai 6 dari bekal yang sudah terbukti di CV dan kuis: kel 'Sudah terbentuk di kamu' (PEKERJAAN)
  atau 'Relevan dengan karirmu sekarang' (ROLE). Kalau sebuah pilihan masih jauh dari bekalnya, tetap bahas dan sebut jaraknya dengan jujur.
- Jawaban target ditulis pengguna dengan bahasanya sendiri. Tafsirkan maksudnya, jangan menyalin mentah sebagai nama peran,
  dan abaikan isi yang bukan tentang pekerjaan. Kalau maksudnya tidak bisa dipahami, perlakukan seperti tanpa target, tapi kel tetap diisi sesuai jenisnya.
- b5.intro: sebut singkat bagaimana jawaban targetnya kamu tafsirkan, dalam kalimat biasa.
- Level untuk isi laporan (tingkat peran) dibaca dari lama kerja di CV: kurang dari 3 tahun = entry. Kalau tidak terbaca, pakai level dari usia.
- Tidak ada arah yang dobel.
- Setiap arah WAJIB punya peran_id dari TABEL REFERENSI PERAN. Nama arah boleh lebih spesifik dari nama di tabel
  (mis. 'Financial Analyst · Corporate Finance' untuk financial_analyst), tapi peran_id harus yang paling dekat. peran_id tidak boleh dobel.

Aturan tipe karir (Bagian 2):
- Urutan tumbuhnya: — (generalis) → I atau T → V atau π → M atau X. 'tuju' dan 'bentuk' tiap jalan TIDAK boleh lebih awal dari 'kamu'.
- Kalau 'kamu' sudah M atau X, 'tuju' sama dengan 'kamu', dan dua jalan menjelaskan cara makin matang di tipe itu
  (mis. memimpin di bidang yang lebih luas, atau menambah satu keahlian dalam), bukan turun ke T.
- 'catatan' ditulis langsung isinya, tanpa awalan "Yang perlu kamu timbang".

Aturan catatan CV (Bagian 4):
- Bahasa CV bukan masalah. Jangan menyarankan mengganti bahasa CV.
- 'sblm' dikutip persis dari CV. 'sdh' adalah versi lebih kuat dari kalimat yang sama, dalam bahasa yang sama dengan 'sblm'.
- Saran 'segera' dan 'kuat' membantu menyusun CV lebih baik dalam bahasa yang dipakai CV itu.
`;

/** Label kelompok arah ke-k (0–5). Diisi sistem supaya selalu sama dengan janji di layar target. */
export function kelArah(jenis: "pekerjaan" | "role" | null, k: number, nTarget = 1): string {
  if (!jenis) return "";
  const pilihan = k < jumlahArahTarget(nTarget);
  if (jenis === "pekerjaan") return pilihan ? "Sesuai keinginanmu" : "Sudah terbentuk di kamu";
  return pilihan ? "Sesuai target karirmu" : "Relevan dengan karirmu sekarang";
}
/** Satu arah per role yang dipilih, paling banyak 6 (sama dengan janji di layar target). */
export function jumlahArahTarget(nTarget: number): number { return Math.min(6, Math.max(1, nTarget || 1)); }

// ---------------------------------------------------------------- Rincian arah (dua potongan paralel)
const peran = obj({
  nama: s("sama persis dengan rencana"),
  fam: s("sama persis dengan rencana"),
  fun: s("fungsi pekerjaan, 1 kalimat"),
  comp: s("5 kompetensi dipisah ' · '"),
  punya: s("yang sudah dia punya dari CV/kuis, 1–2 kalimat"),
  why: s("kenapa cocok, 2 kalimat"),
  day: s("hari-harinya seperti apa, 1–2 kalimat"),
  chal: s("bagian yang akan menantang, jujur, 2 kalimat"),
  path: s("jalur karir dengan panah →"),
  ind: arr(obj({ k: s("'Paling dekat:' atau 'Alternatif:'"), v: s("industri") }), "TEPAT 2 baris"),
  prep: s("yang perlu disiapkan, 1–2 kalimat konkret"),
});

export function skemaArahA() {
  return obj({ peran: arr(peran, "TEPAT 3 peran: arah nomor 1, 2, 3 sesuai rencana") });
}
export function skemaArahB() {
  return obj({
    peran: arr(peran, "TEPAT 3 peran: arah nomor 4, 5, 6 sesuai rencana"),
    tempat: obj({
      intro: s("1–2 kalimat"),
      daftar: arr(obj({ nama: s("jenis tempat kerja"), label: { type: "string", enum: ["Paling cocok", "Cocok", "Perlu ditimbang", "Kurang cocok"] }, teks: s("1–2 kalimat") }), "TEPAT 4, urut dari yang paling cocok"),
      ciri: arr(s(), "TEPAT 4 ciri tempat yang bikin betah"),
      cocok: arr(s(), "TEPAT 4 kata kunci lowongan yang tanda cocok (boleh bahasa Inggris)"),
      tanya: arr(s(), "TEPAT 4 kata di lowongan yang bisa ditanyakan saat wawancara"),
    }),
    b6: obj({
      langkah: arr(s(), "TEPAT 3 langkah minggu ini, konkret, merujuk Bagian 4/5 kalau perlu"),
      batas: s("'Yang perlu kamu tahu soal hasil ini': pola menjawab + catatan bahwa kisaran gaji adalah rentang referensi Nawasena, bukan tawaran; 2–3 kalimat"),
      tutup: s("'Ini potret hari ini, bukan garis finis.' lalu 2 kalimat hal yang layak dibawa pulang; TANPA kalimat judul itu"),
    }),
  });
}

export const TUGAS_ARAH_A = `
Tugas: tulis rincian ARAH 1, 2, 3 dari rencana enam arah (satu halaman per arah).
Gunakan nama dan rumpun yang sama persis dengan rencana. Untuk arah dari keinginan/target, jarak antara keinginan dan bekal
disebut jujur di 'chal' dan 'prep', tanpa menghakimi.
`;
export const TUGAS_ARAH_B = `
Tugas: tulis rincian ARAH 4, 5, 6 dari rencana enam arah, lalu bagian 'Tempat kerja yang paling pas buat kamu',
lalu BAGIAN 6 'Langkah yang Bisa Kamu Lakukan Sekarang' (tiga langkah minggu ini, bukan tahun depan) beserta penutupnya.
Gunakan nama dan rumpun yang sama persis dengan rencana.
`;
