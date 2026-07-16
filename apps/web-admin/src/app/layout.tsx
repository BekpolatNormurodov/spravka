import '@spravka/shared/ui/globals.css';
import type { Metadata } from 'next';
import { ThemeScript } from '@spravka/shared/ui';

export const metadata: Metadata = {
  title: 'Admin — Maʼlumotnoma tizimi',
  description: 'Qarzdorlik yoʻqligi toʻgʻrisidagi maʼlumotnoma — admin paneli',
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
