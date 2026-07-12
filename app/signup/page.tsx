'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const origin = window.location.origin;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.replace('/');
      router.refresh();
      return;
    }

    setMessage('Check your inbox for the verification email, then come back and sign in.');
  }

  async function handleGoogleSignup() {
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
        <h1 className="text-2xl font-bold text-[#14532D]">Create account</h1>
        <p className="mt-1 text-sm text-[#14532D]/70">Sign up with email/password or Google.</p>

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
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
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-[#BBF7D0] px-3 py-2 text-sm outline-none focus:border-[#16A34A]"
              placeholder="At least 6 characters"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-green-700">{message}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-70"
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <div className="my-5 h-px bg-[#BBF7D0]" />

        <button
          type="button"
          onClick={handleGoogleSignup}
          className="w-full rounded-lg border border-[#BBF7D0] px-4 py-2 text-sm font-semibold text-[#14532D] hover:bg-[#F0FDF4]"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-sm text-[#14532D]/80">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[#16A34A]">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
