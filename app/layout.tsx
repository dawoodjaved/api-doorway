import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "APIDoorway — Discover & ship APIs faster",
  description:
    "Publish OpenAPI specs, discover APIs, create keys, and monitor usage in one place.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/logo.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/favicon.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`scroll-smooth ${dmSans.variable} ${syne.variable}`}
    >
      <body className="font-sans antialiased">
        <Providers>
          <Navbar />
          <main className="min-h-[70vh]">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
