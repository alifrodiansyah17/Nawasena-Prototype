import Link from "next/link";
import { Shell } from "@/components/Shell";
import { HelpCard } from "@/components/Help";
import { ResendButton } from "../cek-email/ResendButton";

export default function VerifikasiGagal() {
  return (
    <Shell layar="verifikasi_gagal" back="/daftar/cek-email">
      <div className="stack">
        <h1>Akunmu belum aktif</h1>
        <p className="muted">
          Akun baru aktif setelah link di email dibuka. Kalau linknya sudah lewat 24 jam atau emailnya tidak ketemu, kirim ulang saja. Cek juga folder Promosi atau Spam.
        </p>
        <ResendButton />
        <Link href="/daftar" className="btn btn-ghost">Ganti email</Link>
        <HelpCard layar="verifikasi_gagal" />
      </div>
    </Shell>
  );
}
