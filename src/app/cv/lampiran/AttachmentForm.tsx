"use client";
import { useActionState, useState } from "react";
import { saveAttachment } from "../actions";
import { ukuranFile } from "@/lib/format";

export function AttachmentForm() {
  const [state, action, pending] = useActionState(saveAttachment, undefined);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  return (
    <form action={action} className="stack">
      <input id="att" type="file" name="file" accept=".pdf,.docx,.pptx,.zip" className="sr" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {file ? (
        <div className="file-chip">
          <div><b>{file.name}</b><div className="caption">{ukuranFile(file.size)}</div></div>
          <label htmlFor="att" className="chip">Ganti</label>
        </div>
      ) : (
        <label htmlFor="att" className="drop">
          <span style={{ fontSize: 28 }} aria-hidden>📎</span>
          <b>Pilih file</b>
          <span className="caption">PDF, DOCX, PPTX, ZIP · maks. 10 MB</span>
        </label>
      )}
      <div className="row" aria-hidden><hr className="grow" style={{ border: 0, borderTop: "1px solid var(--line)" }} /><span className="caption">atau</span><hr className="grow" style={{ border: 0, borderTop: "1px solid var(--line)" }} /></div>
      <label className="field">
        Link portofolio
        <input type="url" name="url" placeholder="https://behance.net/namamu" value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      {state?.error ? <p className="error" role="alert">{state.error}</p> : null}
      <button className="btn btn-primary btn-block" disabled={pending || (!file && !url.trim())}>{pending ? "Mengunggah..." : "Unggah dan lanjut"}</button>
      <button className="btn btn-ghost" name="skip" value="1" disabled={pending}>Lewati aja</button>
    </form>
  );
}
