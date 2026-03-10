"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useClerk } from "@clerk/clerk-react";

type AuthMode = "sign-in" | "sign-up";

const authCopy = {
  "sign-in": {
    eyebrow: "Xen Account",
    title: "登录 Xen",
    summary: "继续同步你的词汇、阅读历史和扩展设置。",
    actionLabel: "继续登录",
  },
  "sign-up": {
    eyebrow: "Xen Account",
    title: "创建 Xen 账号",
    summary: "注册后即可在网页翻译、词汇记录和扩展会话之间保持同步。",
    actionLabel: "继续注册",
  },
} as const;

export function AuthLaunchPage({ mode }: { mode: AuthMode }) {
  const { openSignIn, openSignUp } = useClerk();
  const copy = authCopy[mode];

  useEffect(() => {
    if (mode === "sign-in") {
      openSignIn({ signUpUrl: "/sign-up", forceRedirectUrl: "/" });
      return;
    }

    openSignUp({ signInUrl: "/sign-in", forceRedirectUrl: "/" });
  }, [mode, openSignIn, openSignUp]);

  function handleOpen() {
    if (mode === "sign-in") {
      openSignIn({ signUpUrl: "/sign-up", forceRedirectUrl: "/" });
      return;
    }

    openSignUp({ signInUrl: "/sign-in", forceRedirectUrl: "/" });
  }

  return (
    <section className="auth-gateway">
      <p className="auth-gateway-eyebrow">{copy.eyebrow}</p>
      <h1 className="auth-gateway-title">{copy.title}</h1>
      <p className="auth-gateway-summary">{copy.summary}</p>

      <div className="auth-gateway-actions">
        <button type="button" className="auth-button" onClick={handleOpen}>
          {copy.actionLabel}
        </button>
        <Link href="/" className="auth-button auth-button-secondary">
          返回首页
        </Link>
      </div>

      <p className="auth-gateway-note">如果浏览器拦截了弹窗，可以点击上面的按钮继续。</p>
    </section>
  );
}
