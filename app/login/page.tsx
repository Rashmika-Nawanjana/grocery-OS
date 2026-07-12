'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace('/');
    router.refresh();
  }

  async function handleGoogleLogin() {
    setError('');
    const origin = window.location.origin;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7F2] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#BBF7D0] bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-[#14532D]">Sign in</h1>
        <p className="mt-1 text-sm text-[#14532D]/70">Use your email/password or continue with Google.</p>

        <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14532D]">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-[#BBF7D0] px-3 py-2 text-sm outline-none focus:border-[#16A34A]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#14532D]">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-[#BBF7D0] px-3 py-2 text-sm outline-none focus:border-[#16A34A]"
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="my-5 h-px bg-[#BBF7D0]" />

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full rounded-lg border border-[#BBF7D0] px-4 py-2 text-sm font-semibold text-[#14532D] hover:bg-[#F0FDF4]"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-sm text-[#14532D]/80">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-[#16A34A]">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
