import type { Metadata } from "next";
import "./globals.css";
import { AuthShell } from "./auth-shell";

export const metadata: Metadata = {
  title: "Xen",
  description: "Xen web pages and privacy policy.",
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
