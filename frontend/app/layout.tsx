import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthContextProvider } from "@/store/AuthContext";
import { TeamProvider } from "@/store/TeamContext";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FnBox - Self-Hosted Functions as a Service",
  description: "Run serverless functions on your own infrastructure. FnBox is a lightweight, self-hosted FaaS for Python-no cloud lock-in, no cold starts, just functions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased relative`}
      >
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to right, var(--muted) 1px, transparent 1px), linear-gradient(to bottom, var(--muted) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, #5A8C5E 60%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, #5A8C5E 60%, transparent 100%)",
            zIndex: 0
          }}
        />

        {/* All content above pattern */}
        <div className="relative" style={{ zIndex: 1 }}>
          <Toaster />
          <AuthContextProvider>
            <TeamProvider>
              {children}
            </TeamProvider>
          </AuthContextProvider>
        </div>
      </body>
    </html>
  );
}
