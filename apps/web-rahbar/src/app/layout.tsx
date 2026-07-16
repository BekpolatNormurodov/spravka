import '@spravka/shared/ui/globals.css';
import type { Metadata } from 'next';
import { ThemeScript } from '@spravka/shared/ui';

export const metadata: Metadata = {
  title: 'Rahbar — Maʼlumotnoma tizimi',
  description: 'Qarzdorlik yoʻqligi toʻgʻrisidagi maʼlumotnoma — rahbar paneli',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
