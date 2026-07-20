'use client';

import { signOut } from '@/app/actions/auth';

/**
 * Sign-out has to be a POST, not a link: a GET that destroys the session can
 * be triggered by any image tag or prefetch on the page.
 */
export function SignOutButton({ className = '' }: { className?: string }) {
  return (
    <form action={signOut}>
      <button type="submit" className={`text-left ${className}`}>
        Sign out
      </button>
    </form>
  );
}
