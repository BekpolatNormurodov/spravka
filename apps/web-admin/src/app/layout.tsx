import '@spravka/shared/ui/globals.css';
import type { Metadata, Viewport } from 'next';
import { ThemeScript } from '@spravka/shared/ui';

export const metadata: Metadata = {
  title: 'Admin — Maʼlumotnoma tizimi',
  description: 'Qarzdorlik yoʻqligi toʻgʻrisidagi maʼlumotnoma — admin paneli',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f8fd' },
    { media: '(prefers-color-scheme: dark)', color: '#070b16' },
  ],
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
