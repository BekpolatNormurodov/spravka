import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Maʼlumotnoma — tekshirish',
  description: 'Qarzdorlik yoʻqligi toʻgʻrisidagi maʼlumotnomani tekshirish (public)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="bg-slate-100 text-slate-900">{children}</body>
    </html>
  );
}
