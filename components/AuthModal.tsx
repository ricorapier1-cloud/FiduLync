'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
export default function AuthModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async (e: any) => {
    e.preventDefault();
    if (isLogin) {
      await supabase.auth.signInWithPassword({ email, password });
    } else {
      await supabase.auth.signUp({ email, password });
    }
    window.location.reload();
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0b1016] border border-emerald-500/30 p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-6">{isLogin ? 'Login to FiduLync' : 'Create Account'}</h2>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" placeholder="Email" required className="w-full bg-[#131b24] text-white p-3 rounded-lg border border-gray-700 focus:border-emerald-500 outline-none" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" required className="w-full bg-[#131b24] text-white p-3 rounded-lg border border-gray-700 focus:border-emerald-500 outline-none" onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-3 rounded-lg transition-all">{isLogin ? 'Sign In' : 'Sign Up'}</button>
        </form>
        <p className="text-gray-400 text-sm mt-4 text-center cursor-pointer" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Need an account? Sign Up" : "Have an account? Login"}
        </p>
        <button onClick={onClose} className="mt-6 text-red-400 hover:text-red-300 w-full text-center">Cancel</button>
      </div>
    </div>
  );
}
