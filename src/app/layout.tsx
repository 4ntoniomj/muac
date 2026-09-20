import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'muac · Antigravity Pro Multi-Account',
  description: 'Chat de inteligencia artificial con rotación automática de cuentas Antigravity Pro por límites de tokens.',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`dark h-full ${geistSans.variable} ${geistMono.variable}`}>
      <body className="h-full bg-canvas text-slate-100 font-sans antialiased overflow-hidden selection:bg-blue-600/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
