import { Card } from '@/components/ui/Card';
import { AuthForm } from '@/components/auth/AuthForm';
import { signUp } from '@/app/actions/auth';
import { PASSWORD_MIN } from '@/lib/use-cases/auth';

export const metadata = { title: 'Create account · SkyRocket English' };

/**
 * Registration creates nothing but the `app_user` row. Course enrolment and
 * the first unlocked module are materialised on the new learner's first
 * dashboard visit (`ensureActiveEnrollment` / `ensureFirstModuleUnlocked`),
 * so every account starts from a clean, independent progress state.
 */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <Card>
      <h1 className="mb-1 text-lg font-bold tracking-[-.01em]">Create your account</h1>
      <p className="mb-5 text-sm text-fg-muted">Your progress, reviews and streak are tied to it.</p>
      <AuthForm
        action={signUp}
        submitLabel="Create account"
        pendingLabel="Creating…"
        withConfirm
        next={next}
        passwordHint={`At least ${PASSWORD_MIN} characters.`}
        footer={{ question: 'Already have an account?', linkLabel: 'Sign in', href: '/login' }}
      />
    </Card>
  );
}
