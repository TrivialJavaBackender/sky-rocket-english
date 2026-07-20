import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'SkyRocket English',
  description: 'Personal language-learning course engine.',
};

/**
 * Document shell only — fonts, tokens, `<body>`. The signed-in chrome
 * (SideRail / HeaderBar / BottomNav) lives in `app/(app)/layout.tsx`, which
 * the `(auth)` route group deliberately doesn't inherit: the login and
 * register screens must render for a visitor with no session, and must not
 * show navigation into pages they can't open.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400..700;1,400..600&display=swap" />
      </head>
      <body className="bg-bg font-sans text-fg antialiased">{children}</body>
    </html>
  );
}
