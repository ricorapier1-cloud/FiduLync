'use client';
import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
export default function AuthModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    try {
      const { data, error } = isLogin
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
      if (error) {
        setMessage('Authentication failed. Check your details and try again.');
        return;
      }
      if (!isLogin && !data.session) {
        setMessage('Check your email to confirm your account before signing in.');
        return;
      }
      onClose();
    } catch (error) {
      console.error('Supabase authentication request failed:', error);
      setMessage('Authentication is temporarily unavailable. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) setMessage('Google sign-in is temporarily unavailable. Please try again.');
    } catch (error) {
      console.error('Google authentication request failed:', error);
      setMessage('Google sign-in is temporarily unavailable. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0b1016] border border-emerald-500/30 p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-6">{isLogin ? 'Login to MacroLync' : 'Create MacroLync account'}</h2>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" autoComplete="email" placeholder="Email" required className="w-full bg-[#131b24] text-white p-3 rounded-lg border border-gray-700 focus:border-emerald-500 outline-none" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={8} placeholder="Password" required className="w-full bg-[#131b24] text-white p-3 rounded-lg border border-gray-700 focus:border-emerald-500 outline-none" value={password} onChange={(e) => setPassword(e.target.value)} />
          {message && <p className="text-sm text-rose-200" role="alert">{message}</p>}
          <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-black font-bold py-3 rounded-lg transition-all">
            {isSubmitting ? 'Please wait…' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>
        <button type="button" disabled={isSubmitting} onClick={() => void handleGoogleSignIn()} className="mt-4 w-full rounded-lg border border-gray-700 py-3 font-semibold text-white disabled:opacity-60">
          Continue with Google
        </button>
        <button type="button" className="text-gray-400 text-sm mt-4 text-center w-full" onClick={() => { setMessage(''); setIsLogin(!isLogin); }}>
          {isLogin ? "Need an account? Sign Up" : "Have an account? Login"}
        </button>
        <button type="button" onClick={onClose} className="mt-6 text-red-400 hover:text-red-300 w-full text-center">Cancel</button>
      </div>
    </div>
  );
}
