import "server-only";

// Ekstraksi teks CV. Kalau hasilnya < 200 karakter (mis. hasil scan), CV
// dianggap tidak terbaca dan pengguna diminta mengunggah ulang (R3).
export const MIN_CV_CHARS = 200;

export async function extractText(buf: Buffer, mime: string, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await pdfText(pdf, { mergePages: true });
    return clean(Array.isArray(text) ? text.join("\n") : text);
  }
  if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return clean(value);
  }
  // .doc lama: tidak bisa dibaca andal di server. Kembalikan kosong supaya
  // pengguna diminta mengunggah PDF atau DOCX.
  return "";
}

function clean(s: string) {
  return s.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

