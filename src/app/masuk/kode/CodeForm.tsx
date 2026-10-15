"use client";
import Link from "next/link";
import { useActionState } from "react";
import { resendLoginCode, verifyLoginCode } from "../../auth/actions";

// Dua jalan keluar selalu bisa diklik: kirim ulang dan ganti email/HP (AC-01.5).
export function CodeForm() {
  const [state, action, pending] = useActionState(verifyLoginCode, undefined);
  const [rs, resend, resending] = useActionState(resendLoginCode, undefined);
  return (
    <div className="stack">
      <form action={action} className="stack">
        <label className="field">
          <span className="sr">Kode 6 angka</span>
          <input className="otp" type="text" name="token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" placeholder="••••••" />
        </label>
        {state?.error ? <p className="error" role="alert">{state.error}</p> : null}
        <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "Mengecek..." : "Login"}</button>
      </form>
      <div className="row between wrap">
        <form action={resend}>
          <button className="btn btn-ghost" disabled={resending}>{resending ? "Mengirim..." : "Kirim ulang kode"}</button>
        </form>
        <Link href="/masuk" className="btn btn-ghost">Ganti email atau nomor HP</Link>
      </div>
      {rs?.ok ? <p className="caption" role="status">Kode baru sudah dikirim.</p> : null}
      {rs?.error ? <p className="error" role="alert">{rs.error}</p> : null}
    </div>
  );
}
