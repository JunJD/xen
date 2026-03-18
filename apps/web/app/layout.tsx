import type { Metadata } from "next";
import "./globals.css";
import { AuthShell } from "./auth-shell";
import { SITE_URL } from "./install-links";

const siteDescription =
  "Xen 是一个 Chrome 扩展，让你在原网页里直接阅读英文内容，并获得词汇释义、点击发音和段落译文。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Xen",
  title: {
    default: "Xen",
    template: "%s | Xen",
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Xen",
    title: "Xen",
    description: siteDescription,
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Xen",
    description: siteDescription,
  },
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthShell>{children}</AuthShell>
      </body>
    </html>
  );
}
