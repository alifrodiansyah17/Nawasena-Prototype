"use client";
import { useActionState, useRef, useState } from "react";
import { continueFromUpload, uploadCv } from "../actions";
import { ukuranFile } from "@/lib/format";

export function UploadCv({ existing }: { existing: string | null }) {
  const [state, action, pending] = useActionState(uploadCv, undefined);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploaded = !pending && !state?.error && (file !== null || existing !== null);
  return (
    <div className="stack">
      <form ref={formRef} action={action}>
        <input
          ref={inputRef}
          id="cv-file"
          type="file"
          name="file"
          accept=".pdf,.doc,.docx"
          className="sr"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFile({ name: f.name, size: f.size });
            formRef.current?.requestSubmit();
          }}
        />
        {uploaded ? (
          <div className="file-chip">
            <div>
              <b>{file?.name ?? existing}</b>
              {file ? <div className="caption">{ukuranFile(file.size)}</div> : null}
            </div>
            <button type="button" className="chip" onClick={() => inputRef.current?.click()}>Ganti</button>
          </div>
        ) : (
          <label htmlFor="cv-file" className="drop" aria-busy={pending}>
            <span style={{ fontSize: 32 }} aria-hidden>⬆️</span>
            <b>{pending ? "Mengunggah dan membaca CV-mu..." : "Pilih file CV"}</b>
            <span className="caption">PDF, DOC, DOCX · maks. 5 MB</span>
          </label>
        )}
      </form>
      {state?.error ? <p className="error" role="alert">{state.error}</p> : null}
      <form action={continueFromUpload}>
        <button className="btn btn-primary btn-block" disabled={!uploaded}>Lanjut</button>
      </form>
    </div>
  );
}
