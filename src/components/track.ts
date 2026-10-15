"use client";

// Kirim event ke server. Properti level/cv_source ditambahkan di server.
export function track(name: string, props: Record<string, unknown> = {}) {
  try {
    const body = JSON.stringify({ name, props });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    else fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    /* abaikan */
  }
}
