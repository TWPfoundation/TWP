import type { Metadata } from "next";
import { EB_Garamond, Cinzel } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://thewprotocol.online"),
  title: {
    default: "The Witness Protocol Foundation",
    template: "%s — The Witness Protocol Foundation",
  },
  description:
    "A Phase 5 Alpha research initiative soliciting high-signal human testimony for AI alignment. Not a product. Not a startup. A research instrument.",
  keywords: [
    "AI alignment",
    "witness protocol",
    "human testimony",
    "AI safety",
    "research foundation",
    "alignment research",
  ],
  authors: [{ name: "Stichting The Witness Protocol Foundation" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://thewprotocol.online",
    siteName: "The Witness Protocol Foundation",
    title: "The Witness Protocol Foundation",
    description:
      "A Phase 5 Alpha research initiative soliciting high-signal human testimony for AI alignment.",
    images: [
      {
        url: "/twp-logo-white.png",
        width: 512,
        height: 512,
        alt: "The Witness Protocol Foundation",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "The Witness Protocol Foundation",
    description:
      "A Phase 5 Alpha research initiative soliciting high-signal human testimony for AI alignment.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${ebGaramond.variable} ${cinzel.variable} antialiased`}
      >
        <SiteHeader />
        <div className="min-h-screen">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
