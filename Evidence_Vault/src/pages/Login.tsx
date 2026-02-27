import React, { useState } from 'react';
import { Shield, Lock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

/**
 * Demo Credentials for Testing:
 *
 * Regular User Account:
 * - Email: victim@example.com
 * - Password: password
 * - Role: user
 *
 * Admin Account:
 * - Email: authority@police.gov
 * - Password: password
 * - Role: admin
 */
export default function Login({
  onLogin,
  startInSignUpMode = false,
}: {
  onLogin: (user: any) => void;
  startInSignUpMode?: boolean;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('victim@example.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(startInSignUpMode);
  const [loading, setLoading] = useState(false);

  const handleLoginSuccess = (userData: any) => {
    onLogin(userData);
    navigate('/dashboard', { replace: true });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!auth) {
        // Demo mode authentication
        if (
          (email === 'victim@example.com' || email === 'authority@police.gov') &&
          password === 'password'
        ) {
          handleLoginSuccess({
            uid: `user-${Date.now()}`,
            email: email,
            role: email.includes('authority') ? 'admin' : 'user',
          });
        } else {
          setError('Email or password is incorrect');
        }
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        handleLoginSuccess({
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          role: userCredential.user.email?.includes('authority') ? 'admin' : 'user',
        });
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError('Email or password is incorrect');
      } else {
        setError(err.message || 'Sign in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!auth) {
        // Demo mode
        if (email === 'victim@example.com' || email === 'authority@police.gov') {
          setError('User already exists. Please sign in');
        } else {
          handleLoginSuccess({
            uid: `user-${Date.now()}`,
            email: email,
            role: email.includes('authority') ? 'admin' : 'user',
          });
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        handleLoginSuccess({
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          role: userCredential.user.email?.includes('authority') ? 'admin' : 'user',
        });
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('User already exists. Please sign in');
      } else {
        setError(err.message || 'Sign up failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = isSignUp ? handleSignUp : handleSignIn;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      {/* Back to Home */}
      <div className="w-full max-w-md mb-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>

      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Evidence Vault</h1>
          <p className="text-sm text-zinc-500 mt-2 text-center">
            {isSignUp
              ? 'Create your secure evidence preservation account.'
              : 'Secure digital evidence preservation and AI-assisted risk detection platform.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold rounded-lg px-4 py-2.5 transition-colors flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Secure Login'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
          <p className="text-sm text-zinc-400 mb-4">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-emerald-400 hover:underline font-medium"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-800 text-center">
          <p className="text-xs text-zinc-500 mb-2">Demo Accounts:</p>
          <div className="flex justify-center gap-4 text-xs">
            <button
              onClick={() => {
                setEmail('victim@example.com');
                setPassword('password');
                setIsSignUp(false);
              }}
              className="text-emerald-400 hover:underline"
            >
              User (Victim)
            </button>
            <button
              onClick={() => {
                setEmail('authority@police.gov');
                setPassword('password');
                setIsSignUp(false);
              }}
              className="text-emerald-400 hover:underline"
            >
              Admin (Authority)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
