import { Card } from '@/components/ui/Card';
import { AuthForm } from '@/components/auth/AuthForm';
import { signIn } from '@/app/actions/auth';

export const metadata = { title: 'Sign in · SkyRocket English' };

/**
 * `next` is set by `middleware.ts` when it intercepts a deep link from a
 * signed-out visitor, so signing in returns them to the page they wanted
 * instead of dumping them on the dashboard. `app/actions/auth.ts` re-checks
 * that it is a same-origin path before redirecting.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <Card>
      <h1 className="mb-1 text-lg font-bold tracking-[-.01em]">Welcome back</h1>
      <p className="mb-5 text-sm text-fg-muted">Sign in to pick up where you left off.</p>
      <AuthForm
        action={signIn}
        submitLabel="Sign in"
        pendingLabel="Signing in…"
        next={next}
        footer={{ question: 'No account yet?', linkLabel: 'Create one', href: '/register' }}
      />
    </Card>
  );
}
