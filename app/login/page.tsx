import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in or create a MacroLync account.',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="page-content mx-auto max-w-5xl">
      <section className="panel mx-auto max-w-md p-6 sm:p-8">
        <div className="eyebrow">SECURE ACCOUNT ACCESS</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Welcome to MacroLync</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Sign in to manage your account and view your transaction activity.
        </p>
        <LoginForm />
      </section>
    </div>
  );
}
