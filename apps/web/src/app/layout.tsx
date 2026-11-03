import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display, Space_Grotesk } from 'next/font/google';
import { ToastProvider } from '@/components/ui';
import './globals.css';

const heading = Space_Grotesk({ subsets: ['latin'], variable: '--font-heading', display: 'swap' });
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const accent = Playfair_Display({ subsets: ['latin'], variable: '--font-accent', style: ['normal', 'italic'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'CineLog', template: '%s · CineLog' },
  description: 'Your movies. Your memories. Your people. Track your watchlist, keep a movie diary and share films with friends.',
};
export const viewport: Viewport = { themeColor: '#10131F', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable} ${accent.variable}`}>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
