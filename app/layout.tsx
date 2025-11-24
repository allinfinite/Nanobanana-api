import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nanobanana Pro - AI Image Generation Chat",
  description: "Conversational AI-powered image generation platform. Create stunning visuals through natural language with Nanobanana Pro's advanced AI technology.",
  keywords: ["AI image generation", "conversational AI", "image creation", "AI art", "Nanobanana", "generative AI", "creative tools"],
  authors: [{ name: "DNA Levity" }],
  creator: "DNA Levity",
  publisher: "DNA Levity",
  metadataBase: new URL("https://nano.dnalevity.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Nanobanana Pro - AI Image Generation Chat",
    description: "Create stunning visuals through natural language with Nanobanana Pro's advanced AI technology.",
    url: "https://nano.dnalevity.com",
    siteName: "Nanobanana Pro",
    images: [
      {
        url: "/favicon.png",
        width: 1200,
        height: 1200,
        alt: "Nanobanana Pro Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nanobanana Pro - AI Image Generation Chat",
    description: "Create stunning visuals through natural language with Nanobanana Pro's advanced AI technology.",
    images: ["/favicon.png"],
    creator: "@dnalevity",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "any" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/favicon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
