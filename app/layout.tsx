import type { Metadata } from 'next';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import Shell from '@/components/Shell';

const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-grotesk', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jbmono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Veritome · One Answer Across Agents (Snowflake example)',
  description: 'Governed semantic views give every agent the same definitions. Synthetic data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
