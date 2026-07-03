import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { CONTENT } from "@/lib/siteContent";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain.com";
const SITE_TITLE = CONTENT.siteTitle.it;
const SITE_DESCRIPTION = CONTENT.metaDescription;

export const metadata: Metadata = {
  title: {
    default: `${SITE_TITLE} | ${CONTENT.locationDisplay}`,
    template: `%s | ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_TITLE,
    locale: "it_IT",
    alternateLocale: ["en_US", "fr_FR", "de_DE", "es_ES", "pt_PT", "zh_CN", "ja_JP", "ko_KR"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${playfair.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#f5efe1] text-[#1f2a44]">{children}</body>
    </html>
  );
}
