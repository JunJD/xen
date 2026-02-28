import type { Metadata } from "next";
import "./globals.css";
import { AuthShell } from "./auth-shell";

export const metadata: Metadata = {
  title: "Xen Clerk Quickstart",
  description: "Clerk + Next.js App Router",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthShell>{children}</AuthShell>
      </body>
    </html>
  );
}
