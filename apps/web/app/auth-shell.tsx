"use client";

import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react";

type AuthShellProps = {
  children: React.ReactNode;
};

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

export function AuthShell({ children }: AuthShellProps) {
  if (!publishableKey) {
    return (
      <>
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">Xen</div>
            <div className="auth-actions">Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</div>
          </div>
        </header>
        <main>{children}</main>
      </>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">Xen</div>
          <div className="auth-actions">
            <SignedOut>
              <SignInButton mode="modal">
                <button type="button" className="auth-link auth-link-secondary">
                  登录
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button type="button" className="auth-link">
                  注册
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </ClerkProvider>
  );
}
