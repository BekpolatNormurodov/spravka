import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Yurist — Maʼlumotnoma tizimi',
  description: 'Qarzdorlik yoʻqligi toʻgʻrisidagi maʼlumotnoma — yurist paneli',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
