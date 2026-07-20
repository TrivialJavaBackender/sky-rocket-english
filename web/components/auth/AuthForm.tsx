'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import type { AuthFormState } from '@/app/actions/auth';

/**
 * The one form behind both `/login` and `/register` — they differ only in
 * which action they post to, whether a confirm field is shown, and their
 * copy. `useActionState` keeps the server's `{ error }` on screen without
 * turning this into a controlled form.
 */
type Props = {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  pendingLabel: string;
  withConfirm?: boolean;
  /** Where the action sends the user on success; forwarded as a hidden field. */
  next?: string;
  footer: { question: string; linkLabel: string; href: string };
  passwordHint?: string;
};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  // Must be a child of <form> for useFormStatus to see the submission.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="block" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

const fieldClasses =
  'w-full rounded-lg border border-border bg-bg-card px-3.5 py-[11px] text-[15px] text-fg outline-none transition-colors placeholder:text-fg-faintest focus:border-ink';

export function AuthForm({ action, submitLabel, pendingLabel, withConfirm = false, next, footer, passwordHint }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}

      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold text-fg-muted">Username</span>
        <input
          name="username"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          className={fieldClasses}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold text-fg-muted">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete={withConfirm ? 'new-password' : 'current-password'}
          className={fieldClasses}
        />
        {passwordHint && <span className="text-[12.5px] text-fg-faint">{passwordHint}</span>}
      </label>

      {withConfirm && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold text-fg-muted">Confirm password</span>
          <input name="confirm" type="password" required autoComplete="new-password" className={fieldClasses} />
        </label>
      )}

      {state?.error && (
        <p role="alert" className="rounded-lg border border-red-border bg-red-soft px-3.5 py-2.5 text-sm text-red-text">
          {state.error}
        </p>
      )}

      <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />

      <p className="text-center text-sm text-fg-muted">
        {footer.question}{' '}
        <Link href={footer.href} className="font-semibold text-link no-underline hover:text-link-hover hover:underline">
          {footer.linkLabel}
        </Link>
      </p>
    </form>
  );
}
