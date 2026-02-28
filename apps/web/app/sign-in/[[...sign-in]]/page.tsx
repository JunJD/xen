"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/clerk-react";

export default function SignInPage() {
  const { openSignIn } = useClerk();

  useEffect(() => {
    openSignIn({ signUpUrl: "/sign-up", forceRedirectUrl: "/" });
  }, [openSignIn]);

  return (
    <section className="card">
      <h1>Opening sign in...</h1>
    </section>
  );
}
