// Tabel referensi peran dan kisaran gaji (R4, R17).
// Model hanya boleh memilih peran dari tabel ini lewat `id`, dan kisaran gaji
// SELALU diambil dari sini, bukan digenerate model.
//
// PERHATIAN TIM: angka gaji di bawah adalah perkiraan awal (Rp juta per bulan,
// acuan Jakarta) dan wajib divalidasi di Fase 0 sebelum rilis publik.

export interface RoleRef {
  id: string;
  nama: string;
  rumpun: string;
  fungsi: string;
  gaji: [string, string, string]; // masuk · 2–4 tahun · senior/manajer
}

const r = (id: string, nama: string, rumpun: string, fungsi: string, a: string, b: string, c: string): RoleRef => ({
  id,
  nama,
  rumpun,
  fungsi,
  gaji: [a, b, c],
});

export const ROLES: RoleRef[] = [
  // Data & analitik
  r("data_analyst", "Data Analyst", "Data dan analitik", "Mengolah data jadi temuan yang dipakai untuk mengambil keputusan", "6 – 9", "9 – 15", "16 – 28"),
  r("business_analyst", "Business Analyst", "Produk dan teknologi", "Menjembatani orang yang punya masalah dengan tim yang membangun sistemnya", "6,5 – 9", "10 – 16", "18 – 28"),
  r("bi_analyst", "Business Intelligence Analyst", "Data dan analitik", "Membangun dasbor dan laporan rutin yang dibaca manajemen", "6 – 9", "9 – 15", "16 – 26"),
  r("data_scientist", "Data Scientist", "Data dan analitik", "Membuat model prediksi dan eksperimen dari data", "8 – 13", "13 – 22", "24 – 40"),
  r("people_analytics", "People Analytics Analyst", "Sumber daya manusia", "Membaca data karyawan untuk keputusan SDM", "6 – 9", "9 – 14", "15 – 25"),
  // Produk & teknologi
  r("product_manager", "Product Manager", "Produk dan teknologi", "Menentukan fitur apa yang dibangun, untuk siapa, dan kenapa", "9 – 14", "15 – 25", "28 – 50"),
  r("product_owner", "Product Owner", "Produk dan teknologi", "Menjaga prioritas pekerjaan tim pengembang setiap sprint", "8 – 12", "12 – 20", "22 – 35"),
  r("ux_researcher", "UX Researcher", "Produk dan teknologi", "Menggali kebutuhan dan kebiasaan pengguna lewat riset", "7 – 10", "10 – 16", "18 – 30"),
  r("ui_ux_designer", "UI/UX Designer", "Desain", "Merancang tampilan dan alur aplikasi supaya enak dipakai", "6 – 9", "9 – 15", "16 – 28"),
  r("software_engineer", "Software Engineer", "Produk dan teknologi", "Membangun dan merawat aplikasi atau sistem", "8 – 12", "13 – 22", "25 – 45"),
  r("qa_engineer", "QA Engineer", "Produk dan teknologi", "Memastikan aplikasi berjalan sesuai harapan sebelum dirilis", "6 – 9", "9 – 15", "16 – 25"),
  r("it_support", "IT Support Specialist", "Produk dan teknologi", "Menjaga perangkat dan sistem kantor tetap berjalan", "5 – 7", "7 – 10", "11 – 18"),
  r("engineering_manager", "Engineering Manager", "Produk dan teknologi", "Memimpin tim engineer dan menjaga kualitas pengiriman", "25 – 40", "35 – 55", "50 – 80"),
  r("head_of_product", "Head of Product", "Produk dan teknologi", "Mengarahkan strategi produk dan memimpin para product manager", "35 – 55", "45 – 70", "60 – 100"),
  // Operasional & proses
  r("process_improvement", "Process Improvement Officer", "Operasional", "Membenahi alur kerja supaya lebih cepat, murah, dan rapi", "6 – 9", "9 – 14", "15 – 25"),
  r("operations_officer", "Operations Officer", "Operasional", "Menjaga operasional harian berjalan sesuai standar", "5 – 7", "7 – 11", "12 – 20"),
  r("supply_chain_analyst", "Supply Chain Analyst", "Operasional", "Merencanakan stok, pengadaan, dan distribusi barang", "6 – 9", "9 – 14", "15 – 25"),
  r("ppic", "PPIC Staff", "Operasional", "Menyusun rencana produksi dan mengendalikan persediaan", "5 – 8", "8 – 12", "13 – 20"),
  r("project_control", "Project Control & Cost Analyst", "Proyek", "Menjaga proyek tetap di dalam anggaran dan jadwal", "7 – 12", "10 – 16", "16 – 25"),
  r("project_coordinator", "Project Coordinator", "Proyek", "Mengatur jadwal, orang, dan dokumen supaya proyek jalan", "5 – 8", "8 – 12", "13 – 22"),
  r("project_manager", "Project Manager", "Proyek", "Memimpin proyek dari rencana sampai serah terima", "12 – 18", "18 – 28", "28 – 45"),
  r("qhse_officer", "QHSE Officer", "Operasional", "Menjaga mutu, keselamatan, dan kepatuhan lingkungan kerja", "6 – 9", "9 – 14", "15 – 25"),
  // Keuangan & risiko
  r("financial_analyst", "Financial Analyst", "Keuangan", "Menyusun anggaran, proyeksi, dan analisis untuk keputusan keuangan", "6 – 10", "9 – 14", "14 – 22"),
  r("accounting_staff", "Accounting Staff", "Keuangan", "Mencatat transaksi dan menyusun laporan keuangan", "5 – 7", "7 – 10", "12 – 20"),
  r("tax_staff", "Tax Staff", "Keuangan", "Menghitung dan melaporkan pajak perusahaan", "5 – 8", "8 – 12", "13 – 22"),
  r("risk_analyst", "Risk Management Analyst", "Keuangan", "Mengenali dan mengawasi risiko operasional atau keuangan", "6 – 11", "9 – 15", "18 – 30"),
  r("internal_auditor", "Internal Auditor", "Keuangan", "Memeriksa apakah proses dan angka perusahaan sudah benar", "6 – 9", "9 – 14", "15 – 25"),
  r("credit_analyst", "Credit Analyst", "Keuangan", "Menilai kelayakan calon peminjam", "6 – 9", "9 – 13", "14 – 22"),
  r("finance_manager", "Finance Manager", "Keuangan", "Memimpin fungsi keuangan dan perencanaan anggaran", "20 – 30", "28 – 40", "40 – 65"),
  // SDM
  r("hr_generalist", "HR Generalist", "Sumber daya manusia", "Mengurus berbagai kebutuhan karyawan dari masuk sampai keluar", "5 – 7", "7 – 11", "12 – 20"),
  r("talent_acquisition", "Talent Acquisition Specialist", "Sumber daya manusia", "Mencari dan menyeleksi calon karyawan", "5 – 8", "8 – 13", "14 – 24"),
  r("ld_officer", "Learning & Development Officer", "Sumber daya manusia", "Merancang dan menjalankan pelatihan karyawan", "5 – 7", "7 – 10", "12 – 20"),
  r("talent_competency", "Talent & Competency Analyst", "Sumber daya manusia", "Memetakan kompetensi jabatan dan kesiapan karyawan", "5 – 8", "7 – 11", "12 – 20"),
  r("hrbp", "HR Business Partner", "Sumber daya manusia", "Menjadi mitra SDM bagi pimpinan divisi", "12 – 18", "18 – 28", "28 – 45"),
  r("mt_hc", "Management Trainee · Human Capital", "Sumber daya manusia", "Program rotasi di fungsi SDM untuk calon pemimpin", "6 – 10", "7 – 12", "15 – 25"),
  // Pemasaran, penjualan, komunikasi
  r("digital_marketing", "Digital Marketing Specialist", "Pemasaran", "Menjalankan kampanye iklan dan konten digital", "5 – 8", "8 – 13", "14 – 24"),
  r("content_strategist", "Content Strategist", "Pemasaran", "Merencanakan konten yang konsisten dan punya tujuan", "5 – 8", "8 – 13", "14 – 22"),
  r("social_media", "Social Media Specialist", "Pemasaran", "Mengelola akun media sosial dan komunitasnya", "5 – 7", "7 – 11", "12 – 18"),
  r("brand_executive", "Brand Executive", "Pemasaran", "Menjaga citra dan pertumbuhan satu merek", "6 – 9", "9 – 15", "16 – 28"),
  r("marketing_analyst", "Marketing Analyst", "Pemasaran", "Membaca data kampanye dan perilaku pelanggan", "6 – 9", "9 – 14", "15 – 24"),
  r("pr_comms", "Public Relations Officer", "Komunikasi", "Mengelola hubungan dengan media dan publik", "5 – 8", "8 – 12", "13 – 22"),
  r("copywriter", "Copywriter", "Kreatif", "Menulis kalimat iklan, kampanye, dan konten merek", "5 – 7", "7 – 11", "12 – 20"),
  r("graphic_designer", "Graphic Designer", "Desain", "Membuat materi visual untuk merek dan kampanye", "5 – 7", "7 – 10", "11 – 18"),
  r("account_executive", "Account Executive", "Penjualan", "Mencari dan menutup penjualan ke klien bisnis", "5 – 8", "8 – 14", "15 – 25"),
  r("key_account", "Key Account Manager", "Penjualan", "Menjaga dan menumbuhkan klien besar", "10 – 15", "15 – 22", "22 – 35"),
  r("customer_success", "Customer Success Specialist", "Layanan pelanggan", "Memastikan pelanggan berhasil memakai produk", "5 – 8", "8 – 12", "13 – 22"),
  r("marketing_manager", "Marketing Manager", "Pemasaran", "Memimpin strategi dan tim pemasaran", "18 – 28", "25 – 38", "35 – 60"),
  // Konsultan, kebijakan, pendidikan, lain-lain
  r("management_consultant", "Management Consultant", "Konsultan", "Membantu klien memecahkan masalah bisnis", "9 – 14", "14 – 22", "25 – 45"),
  r("policy_analyst", "Policy Analyst", "Kebijakan publik", "Meneliti dan merumuskan usulan kebijakan", "6 – 9", "9 – 14", "15 – 25"),
  r("research_assistant", "Research Associate", "Riset", "Membantu merancang, menjalankan, dan menulis riset", "5 – 8", "8 – 12", "13 – 22"),
  r("instructional_designer", "Instructional Designer", "Pendidikan", "Merancang materi belajar yang efektif", "6 – 9", "9 – 13", "14 – 22"),
  r("teacher", "Guru atau Pengajar", "Pendidikan", "Mengajar dan mendampingi perkembangan murid", "4 – 6", "6 – 9", "10 – 15"),
  r("community_manager", "Community Manager", "Komunitas", "Membangun dan merawat komunitas pengguna", "5 – 8", "8 – 12", "13 – 22"),
  r("legal_officer", "Legal Officer", "Hukum", "Menyusun dan meninjau kontrak serta kepatuhan", "6 – 9", "9 – 15", "16 – 30"),
  r("mt_general", "Management Trainee", "Program pengembangan", "Program rotasi lintas fungsi untuk calon pemimpin", "6 – 10", "7 – 12", "15 – 25"),
  r("admin_secretary", "Executive Assistant", "Administrasi", "Mengatur agenda, dokumen, dan koordinasi pimpinan", "5 – 7", "7 – 10", "11 – 18"),
  r("field_engineer", "Field Engineer", "Teknik", "Memasang, memelihara, dan memperbaiki peralatan di lapangan", "6 – 9", "9 – 14", "15 – 25"),
  r("production_engineer", "Production Engineer", "Teknik", "Menjaga proses produksi efisien dan sesuai mutu", "6 – 9", "9 – 14", "15 – 25"),
];

export const ROLE_IDS = ROLES.map((x) => x.id) as [string, ...string[]];
export const roleById = (id: string) => ROLES.find((x) => x.id === id);

export const SALARY_LABELS = ["Saat masuk peran ini", "2–4 tahun di peran ini", "Senior atau manajer"];
export const SALARY_NOTE =
  "Kisaran bulanan dari tabel referensi Nawasena, acuan Jakarta, bukan tawaran dan bukan janji. Gaji di kota lain bisa lebih rendah.";

// Teks tabel untuk prompt (stabil, ikut di-cache).
export function rolesTableText(): string {
  return ROLES.map((x) => `${x.id} | ${x.nama} | ${x.rumpun} | ${x.fungsi}`).join("\n");
}
