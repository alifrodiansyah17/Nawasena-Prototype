import { cookies } from "next/headers";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { ResendButton } from "./ResendButton";

export default async function CekEmail() {
  const email = (await cookies()).get("nws_email")?.value ?? "emailmu";
  return (
    <Shell layar="verifikasi_email">
      <div className="stack center" style={{ ["--gap" as string]: "14px", paddingTop: 24 }}>
        <div style={{ fontSize: 48 }} aria-hidden>📬</div>
        <h1>Cek email kamu ya</h1>
        <p className="muted">
          Kami kirim link verifikasi ke <b style={{ color: "var(--ink)" }}>{email}</b>. Buka link itu untuk mengaktifkan akunmu. Linknya berlaku 24 jam.
        </p>
        <ResendButton />
        <Link href="/daftar/gagal" className="btn btn-ghost">Belum sempat buka email</Link>
        <Link href="/daftar" className="caption">Salah tulis email? Daftar ulang</Link>
      </div>
    </Shell>
  );
}
