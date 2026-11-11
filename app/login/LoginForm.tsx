'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function getReturnPath() {
  const requestedPath = new URLSearchParams(window.location.search).get('next');
  if (!requestedPath || !requestedPath.startsWith('/') || requestedPath.startsWith('//')) {
    return '/dashboard';
  }

  const destination = new URL(requestedPath, window.location.origin);
  return destination.origin === window.location.origin
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : '/dashboard';
}

function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const code = typeof error === 'object' && error !== null && 'code' in error
    && typeof error.code === 'string'
    ? error.code
    : '';
  const normalizedMessage = `${code} ${message}`.toLowerCase();
  if (normalizedMessage.includes('invalid login credentials') || normalizedMessage.includes('invalid_credentials')) {
    return 'The email or password is incorrect.';
  }
  if (normalizedMessage.includes('email not confirmed') || normalizedMessage.includes('email_not_confirmed')) {
    return 'Confirm your email address before signing in.';
  }
  if (normalizedMessage.includes('user_already_exists') || normalizedMessage.includes('user already registered')) {
    return 'An account may already exist for this email. Try signing in instead.';
  }
  if (normalizedMessage.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (normalizedMessage.includes('failed to fetch') || normalizedMessage.includes('network')) {
    return 'The authentication service could not be reached. Check your connection and try again.';
  }
  return 'Authentication could not be completed. Please try again.';
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const finishSignIn = () => {
      if (!active) return;
      router.replace(getReturnPath());
      router.refresh();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event !== 'SIGNED_OUT') finishSignIn();
    });

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setMessage('Unable to verify your account session. Please try again.');
          setMessageIsError(true);
        } else if (data.session) {
          finishSignIn();
        }

        const query = new URLSearchParams(window.location.search);
        if (query.get('confirmed') === '1') {
          setMessage('Your email is confirmed. You can now sign in.');
          setMessageIsError(false);
        }
        setIsCheckingSession(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Unable to verify the Supabase session:', error);
        setMessage('Unable to verify your account session. Please try again.');
        setMessageIsError(true);
        setIsCheckingSession(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      const confirmationUrl = new URL('/login?confirmed=1', window.location.origin);
      confirmationUrl.searchParams.set('next', getReturnPath());
      const { data, error } = isSignUp
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: confirmationUrl.toString() },
          })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (error) throw error;

      if (isSignUp && !data.session) {
        setMessage('Check your email to confirm your account before signing in.');
        setMessageIsError(false);
      } else if (data.session) {
        router.replace(getReturnPath());
        router.refresh();
      } else {
        setMessage('Authentication did not return an active session. Please try again.');
        setMessageIsError(true);
      }
    } catch (error) {
      console.error('Supabase authentication failed:', error);
      setMessage(getAuthErrorMessage(error));
      setMessageIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsSubmitting(true);
    setMessage('');

    try {
      const callback = new URL('/login', window.location.origin);
      callback.searchParams.set('next', getReturnPath());
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callback.toString() },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Google authentication failed:', error);
      setMessage('Google sign-in is unavailable. Please try email and password instead.');
      setMessageIsError(true);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="field-label" htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            className="field-control"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="field-control"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            minLength={isSignUp ? 8 : undefined}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {message && (
          <p className={messageIsError ? 'text-sm text-rose-200' : 'text-sm text-emerald-200'} role={messageIsError ? 'alert' : 'status'}>
            {message}
          </p>
        )}
        <button className="primary-button w-full" type="submit" disabled={isSubmitting || isCheckingSession}>
          {isSubmitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[10px] text-slate-500">
        <span className="h-px flex-1 bg-white/10" />
        OR
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        className="secondary-button w-full"
        type="button"
        disabled={isSubmitting || isCheckingSession}
        onClick={() => void handleGoogleSignIn()}
      >
        Continue with Google
      </button>

      <p className="mt-5 text-center text-xs text-slate-400">
        {isSignUp ? 'Already have an account?' : 'New to MacroLync?'}{' '}
        <button
          className="font-semibold text-emerald-300 hover:text-emerald-200"
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            setIsSignUp((current) => !current);
            setMessage('');
          }}
        >
          {isSignUp ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </div>
  );
}
