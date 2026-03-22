import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { AuthProvider } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DialogProvider } from "@/components/ui/dialog-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Backing & Score",
  description: "Web DAW + Live — play along, arrange, perform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Script src="https://cdn.jsdelivr.net/combine/npm/tone@14.7.58,npm/@magenta/music@1.23.1/es6/core.js,npm/html-midi-player@1.5.0" strategy="beforeInteractive" />
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <DialogProvider>
              <Header />
              {children}
            </DialogProvider>
            <Toaster position="bottom-right" richColors theme="system" />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
