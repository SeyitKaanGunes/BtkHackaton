import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fintwin",
  description: "Kişisel ve KOBİ finansal ikiz uygulaması"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>{children}</body>
    </html>
  );
}
