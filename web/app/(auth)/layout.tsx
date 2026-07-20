import type { ReactNode } from 'react';

/**
 * Chrome-free frame for `/login` and `/register`: a centred card, no
 * navigation. This group intentionally sits outside `(app)`, so nothing here
 * touches the session or the database — which is what lets these routes
 * render for a visitor who has no account yet.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-[18px] py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 text-center">
          <div className="text-[22px] font-bold tracking-[-.01em]">SkyRocket</div>
          <div className="mt-1 text-[13.5px] text-fg-muted">English · B2+ → C1</div>
        </div>
        {children}
      </div>
    </main>
  );
}
