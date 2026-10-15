"use client";
import { useActionState } from "react";
import { resendVerification } from "../../auth/actions";

export function ResendButton() {
  const [state, action, pending] = useActionState(resendVerification, undefined);
  return (
    <form action={action} className="stack" style={{ ["--gap" as string]: "6px" }}>
      <button className="btn btn-secondary btn-block" disabled={pending}>{pending ? "Mengirim..." : "Kirim ulang link"}</button>
      {state?.ok ? <p className="caption" role="status">Link baru sudah dikirim.</p> : null}
      {state?.error ? <p className="error" role="alert">{state.error}</p> : null}
    </form>
  );
}
