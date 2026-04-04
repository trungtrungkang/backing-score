import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { AuthProvider } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DialogProvider } from "@/components/ui/dialog-provider";
import { Toaster } from "@/components/ui/sonner";
import { RouteChangeCleanup } from "@/components/providers/RouteChangeCleanup";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

export const runtime = "edge";

const geistSans = localFont({
  src: "../fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://backingscore.com"),
  title: {
    default: "Backing & Score — Interactive Sheet Music & Play-Along",
    template: "%s | Backing & Score",
  },
  description:
    "A play-along library with interactive sheet music, real-time pitch detection, and practice mode. The ultimate tool for musicians who want to practice at their own pace.",
  keywords: [
    "sheet music",
    "play along",
    "backing track",
    "practice mode",
    "interactive music",
    "pitch detection",
    "music score",
    "MIDI",
  ],
  authors: [{ name: "Backing & Score" }],
  creator: "Backing & Score",
  openGraph: {
    type: "website",
    siteName: "Backing & Score",
    title: "Backing & Score — Interactive Sheet Music & Play-Along",
    description:
      "A play-along library with interactive sheet music, real-time pitch detection, and practice mode.",
    url: "https://backingscore.com",
    images: [
      {
        url: "/apple-icon.png",
        width: 512,
        height: 512,
        alt: "Backing & Score",
      },
    ],
    locale: "en",
    alternateLocale: ["vi", "zh-CN", "zh-TW", "es", "fr", "de", "ja", "ko"],
  },
  twitter: {
    card: "summary",
    title: "Backing & Score — Interactive Sheet Music & Play-Along",
    description:
      "Play along with interactive sheet music, real-time pitch detection, and practice mode.",
    images: ["/apple-icon.png"],
  },
  alternates: {
    canonical: "https://backingscore.com/en",
    languages: {
      en: "https://backingscore.com/en",
      vi: "https://backingscore.com/vi",
      "zh-CN": "https://backingscore.com/zh-CN",
      "zh-TW": "https://backingscore.com/zh-TW",
      es: "https://backingscore.com/es",
      fr: "https://backingscore.com/fr",
      de: "https://backingscore.com/de",
      ja: "https://backingscore.com/ja",
      ko: "https://backingscore.com/ko",
      "x-default": "https://backingscore.com/en",
    },
  },
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: any;
}>) {
  const { locale } = await Promise.resolve(params);
  if (!routing.locales.includes(locale)) {
    notFound();
  }
  
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#C8A856" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <Script src="https://cdn.jsdelivr.net/combine/npm/tone@14.7.58,npm/@magenta/music@1.23.1/es6/core.js,npm/html-midi-player@1.5.0" strategy="afterInteractive" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AuthProvider>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
              <DialogProvider>
                <RouteChangeCleanup />
                <ErrorBoundary>
                  <Header />
                  {children}
                </ErrorBoundary>
              </DialogProvider>
              <Toaster position="bottom-right" richColors theme="system" />
            </ThemeProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
