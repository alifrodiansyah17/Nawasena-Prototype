"use client";
import { useActionState } from "react";
import { adminRequestCode, adminVerifyCode } from "../actions";

export function AdminLogin() {
  const [req, request, p1] = useActionState(adminRequestCode, undefined);
  const [ver, verify, p2] = useActionState(adminVerifyCode, undefined);
  if (!req?.ok)
    return (
      <form action={request} className="stack">
        <label className="field">Email kantor<input type="email" name="email" required autoComplete="email" /></label>
        {req?.error ? <p className="error">{req.error}</p> : null}
        <button className="btn btn-primary" disabled={p1}>Kirim kode</button>
      </form>
    );
  return (
    <form action={verify} className="stack">
      <label className="field">Kode 6 angka dari email<input className="otp" name="token" inputMode="numeric" maxLength={6} autoComplete="one-time-code" /></label>
      {ver?.error ? <p className="error">{ver.error}</p> : null}
      <button className="btn btn-primary" disabled={p2}>Lanjut</button>
    </form>
  );
}
