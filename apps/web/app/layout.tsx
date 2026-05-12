import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fintwin",
  description: "AI Financial Digital Twin dashboard"
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
