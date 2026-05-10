import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-ui",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Fintwin",
  description: "AI Financial Digital Twin dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className={manrope.variable}>{children}</body>
    </html>
  );
}
