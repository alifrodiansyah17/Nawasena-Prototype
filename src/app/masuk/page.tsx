import Link from "next/link";
import { Shell } from "@/components/Shell";
import { LoginForm } from "./LoginForm";

export default function Masuk() {
  return (
    <Shell layar="masuk" back="/">
      <div className="stack">
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <h1>Login</h1>
          <p className="muted">Kami kirim kode 6 angka. Tidak perlu password.</p>
        </div>
        <LoginForm />
        <p className="center">
          Belum punya akun? <Link href="/daftar">Daftar di sini</Link>
        </p>
      </div>
    </Shell>
  );
}
