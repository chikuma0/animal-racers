import localFont from 'next/font/local';
import type { Metadata, Viewport } from 'next';
import './globals.css';

const displayFont = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-display',
  weight: '100 900',
});

const monoFont = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'Animal Racers',
  description: 'Race feral champions through jungle tracks and arena brawls.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${displayFont.variable} ${monoFont.variable} overscroll-none overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}
