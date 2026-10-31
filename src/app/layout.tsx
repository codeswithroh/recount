import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body" });
const code = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code" });

export const metadata: Metadata = {
  title: "Recount",
  description: "Re-runs the maths behind published statistics and shows whether the number holds up.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${code.variable}`}>
      <body>{children}</body>
    </html>
  );
}
