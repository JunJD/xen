"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/clerk-react";

export default function SignUpPage() {
  const { openSignUp } = useClerk();

  useEffect(() => {
    openSignUp({ signInUrl: "/sign-in", forceRedirectUrl: "/" });
  }, [openSignUp]);

  return (
    <section className="card">
      <h1>Opening sign up...</h1>
    </section>
  );
}
