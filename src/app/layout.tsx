import type { Metadata, Viewport } from "next";
import { Nunito, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-nunito" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "Nawasena — Kenali potensimu, raih masa depanmu",
  description: "Kuis 36 kalimat, CV yang ramah ATS, dan Peta Potensimu: enam bagian tentang cara kerjamu dan arah karir berikutnya.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#009FE3" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${nunito.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
