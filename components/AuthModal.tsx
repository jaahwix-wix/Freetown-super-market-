'use client';

import React, { useState } from 'react';
import { X, Eye, EyeOff, Lock, UserCheck, MailCheck, ShieldCheck } from 'lucide-react';
import { useAuth, type AuthModalContext, type AuthModalMode } from './AuthProvider';

interface UsernamePasswordAuthCardProps {
  context?: AuthModalContext;
  initialMode?: AuthModalMode;
  onSuccess?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
}

export function UsernamePasswordAuthCard({
  context = 'customer',
  initialMode = 'signin',
  onSuccess,
  showCloseButton = false,
  onClose,
}: UsernamePasswordAuthCardProps) {
  const {
    user,
    emailVerified,
    authError,
    clearAuthError,
    signInWithUsernamePassword,
    registerWithUsernamePassword,
    sendPasswordReset,
    resendVerificationEmail,
    refreshVerification,
    signInWithGoogle,
    signOut,
  } = useAuth();

  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const displayedError = localError || authError;

  const switchMode = (nextMode: AuthModalMode) => {
    setMode(nextMode);
    setLocalError(null);
    setInfoMessage(null);
    clearAuthError();
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setInfoMessage(null);
    setBusy(true);
    try {
      const ok = await signInWithUsernamePassword(identifier, password);
      if (ok && onSuccess) onSuccess();
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setInfoMessage(null);

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const result = await registerWithUsernamePassword(username, email, password);
      if (result.ok) {
        if (result.needsVerification) {
          setInfoMessage(
            `Account created for ${username.trim()}. Check ${email.trim()} for your verification link to activate checkout.`
          );
        } else if (onSuccess) {
          onSuccess();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    setLocalError(null);
    setInfoMessage(null);
    setBusy(true);
    try {
      const sentTo = await sendPasswordReset(identifier);
      if (sentTo) {
        setInfoMessage(`Password reset link sent to ${sentTo}.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setInfoMessage(null);
    setBusy(true);
    try {
      const ok = await signInWithGoogle();
      if (ok && onSuccess) onSuccess();
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setLocalError(null);
    setBusy(true);
    try {
      const sent = await resendVerificationEmail();
      if (sent) {
        setInfoMessage(
          `Verification link sent to ${user?.email}. Open the link in your inbox, then click "I've Verified — Refresh".`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshVerification = async () => {
    setLocalError(null);
    setBusy(true);
    try {
      const verified = await refreshVerification();
      if (verified) {
        setInfoMessage('Email verified. Your account is now active.');
        if (onSuccess) onSuccess();
      } else {
        setLocalError(
          'Email is still unverified. Click the verification link sent to your inbox first.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  // Signed in with password but awaiting email verification
  if (user && !emailVerified) {
    return (
      <div className="bg-white border border-[#DCE1DD] rounded-lg shadow-xl overflow-hidden text-left">
        <div className="px-6 py-4 border-b border-[#E3E7E4] bg-[#F8F9F8] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MailCheck className="w-4 h-4 text-[#156145]" />
            <h2 className="font-display text-base font-bold text-[#141715]">
              Verify Your Account Email
            </h2>
          </div>
          {showCloseButton && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close authentication modal"
              className="p-1.5 rounded-md text-[#4F5852] hover:bg-[#E5E9E7] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-[#4F5852] leading-relaxed">
            You are signed in as{' '}
            <strong className="text-[#141715]">
              {user.displayName || user.email}
            </strong>{' '}
            (<span className="font-mono text-xs">{user.email}</span>). Please click the
            verification link sent to your email address before accessing protected store
            actions.
          </p>

          {displayedError && (
            <p
              role="alert"
              className="text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-md px-3 py-2"
            >
              {displayedError}
            </p>
          )}

          {infoMessage && (
            <p className="text-xs font-medium text-[#156145] bg-[#ECFDF5] border border-[#A7F3D0] rounded-md px-3 py-2">
              {infoMessage}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={handleRefreshVerification}
              className="flex-1 h-10 px-4 bg-[#156145] hover:bg-[#114E37] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Checking...' : "I've Verified — Refresh"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleResendVerification}
              className="h-10 px-4 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-xs font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              Resend Link
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={signOut}
              className="h-10 px-4 bg-white border border-[#D7DDD9] hover:bg-[#F8F9F8] text-[#4F5852] text-xs font-semibold rounded-md transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#DCE1DD] rounded-lg shadow-xl overflow-hidden text-left">
      <div className="px-6 py-4 border-b border-[#E3E7E4] bg-[#F8F9F8] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {context === 'admin' ? (
            <ShieldCheck className="w-4 h-4 text-[#156145]" />
          ) : (
            <UserCheck className="w-4 h-4 text-[#156145]" />
          )}
          <h2 className="font-display text-base font-bold text-[#141715]">
            {context === 'admin'
              ? 'Administrator Login'
              : mode === 'signin'
                ? 'Customer & Staff Sign In'
                : 'Create Freetown Account'}
          </h2>
        </div>
        {showCloseButton && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="p-1.5 rounded-md text-[#4F5852] hover:bg-[#E5E9E7] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-6 space-y-5">
        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#EAECEB] rounded-md">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className={`py-2 text-xs font-semibold rounded transition-colors cursor-pointer ${
              mode === 'signin'
                ? 'bg-white text-[#141715] shadow-sm'
                : 'text-[#4F5852] hover:text-[#141715]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`py-2 text-xs font-semibold rounded transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-[#141715] shadow-sm'
                : 'text-[#4F5852] hover:text-[#141715]'
            }`}
          >
            Create Account
          </button>
        </div>

        {context === 'admin' && mode === 'signin' && (
          <p className="text-xs text-[#4F5852] leading-relaxed">
            Enter your administrator username (<span className="font-mono">admin</span>) or
            email (<span className="font-mono">nabieumelissajosephine@gmail.com</span>) and
            password to manage stock and upload products.
          </p>
        )}

        {displayedError && (
          <p
            role="alert"
            className="text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-md px-3 py-2.5 leading-relaxed"
          >
            {displayedError}
          </p>
        )}

        {infoMessage && (
          <p className="text-xs font-medium text-[#156145] bg-[#ECFDF5] border border-[#A7F3D0] rounded-md px-3 py-2.5 leading-relaxed">
            {infoMessage}
          </p>
        )}

        {mode === 'signin' ? (
          <form onSubmit={handleSignInSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor={`auth-identifier-${context}`}
                className="block text-xs font-semibold text-[#3B443E] mb-1"
              >
                Username or Email
              </label>
              <input
                id={`auth-identifier-${context}`}
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  context === 'admin'
                    ? 'admin or nabieumelissajosephine@gmail.com'
                    : 'Enter your username or email'
                }
                className="w-full h-10 px-3 text-sm bg-white border border-[#D7DDD9] rounded-md text-[#141715] focus:outline-none focus:border-[#156145]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor={`auth-password-${context}`}
                  className="text-xs font-semibold text-[#3B443E]"
                >
                  Password
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleForgotPassword}
                  className="text-xs font-medium text-[#156145] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id={`auth-password-${context}`}
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-10 pl-3 pr-10 text-sm bg-white border border-[#D7DDD9] rounded-md text-[#141715] focus:outline-none focus:border-[#156145]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#5B655E] hover:text-[#141715] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 bg-[#156145] hover:bg-[#114E37] disabled:opacity-50 text-white text-sm font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{busy ? 'Signing In...' : 'Sign In'}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor={`reg-username-${context}`}
                className="block text-xs font-semibold text-[#3B443E] mb-1"
              >
                Username
              </label>
              <input
                id={`reg-username-${context}`}
                type="text"
                required
                minLength={2}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="aminata_kamara"
                className="w-full h-10 px-3 text-sm bg-white border border-[#D7DDD9] rounded-md text-[#141715] focus:outline-none focus:border-[#156145]"
              />
            </div>

            <div>
              <label
                htmlFor={`reg-email-${context}`}
                className="block text-xs font-semibold text-[#3B443E] mb-1"
              >
                Email Address (for verification & order receipts)
              </label>
              <input
                id={`reg-email-${context}`}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-10 px-3 text-sm bg-white border border-[#D7DDD9] rounded-md text-[#141715] focus:outline-none focus:border-[#156145]"
              />
            </div>

            <div>
              <label
                htmlFor={`reg-password-${context}`}
                className="block text-xs font-semibold text-[#3B443E] mb-1"
              >
                Password (minimum 6 characters)
              </label>
              <div className="relative">
                <input
                  id={`reg-password-${context}`}
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full h-10 pl-3 pr-10 text-sm bg-white border border-[#D7DDD9] rounded-md text-[#141715] focus:outline-none focus:border-[#156145]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#5B655E] hover:text-[#141715] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor={`reg-confirm-${context}`}
                className="block text-xs font-semibold text-[#3B443E] mb-1"
              >
                Confirm Password
              </label>
              <input
                id={`reg-confirm-${context}`}
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full h-10 px-3 text-sm bg-white border border-[#D7DDD9] rounded-md text-[#141715] focus:outline-none focus:border-[#156145]"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 bg-[#156145] hover:bg-[#114E37] disabled:opacity-50 text-white text-sm font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>{busy ? 'Creating Account...' : 'Create Account'}</span>
            </button>
          </form>
        )}

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-[#E3E7E4]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2.5 text-[#5B655E]">or</span>
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={handleGoogleSignIn}
          className="w-full h-10 px-4 bg-[#F1F3F2] hover:bg-[#E5E9E7] text-[#141715] text-xs font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
        >
          Continue with Google Account
        </button>
      </div>
    </div>
  );
}

export function AuthModal() {
  const { authModalOpen, authModalContext, authModalMode, closeAuthModal } = useAuth();

  if (!authModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Account sign in"
    >
      <div className="w-full max-w-md">
        <UsernamePasswordAuthCard
          key={`${authModalContext}-${authModalMode}`}
          context={authModalContext}
          initialMode={authModalMode}
          showCloseButton
          onClose={closeAuthModal}
          onSuccess={closeAuthModal}
        />
      </div>
    </div>
  );
}
