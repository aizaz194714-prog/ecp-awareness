import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'ECP Voter Awareness', template: '%s | ECP Voter Awareness' },
  description: 'Learn the voting process through official resources, an interactive maze, and a short quiz.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#075844' };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
