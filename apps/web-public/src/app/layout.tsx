import '@spravka/shared/ui/globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Maʼlumotnoma — tekshirish',
  description: 'Qarzdorlik yoʻqligi toʻgʻrisidagi maʼlumotnomani tekshirish (public)',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f8fd' },
    { media: '(prefers-color-scheme: dark)', color: '#070b16' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="bg-slate-100 text-slate-900">{children}</body>
    </html>
  );
}
