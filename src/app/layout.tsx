import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'muac · Antigravity Pro Multi-Account',
  description: 'Chat de inteligencia artificial con rotación automática de cuentas Antigravity Pro por límites de tokens.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark h-full">
      <body className="h-full bg-background text-slate-100 antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
