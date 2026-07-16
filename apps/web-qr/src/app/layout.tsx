import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QRCode Pro — Dinamik QR boshqaruvi",
  description:
    "Dinamik QR kodlar tizimi. Havola o'zgarmaydi, kontent (matn, fayl, rasm, HTML) istalgan vaqt o'zgartiriladi.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
