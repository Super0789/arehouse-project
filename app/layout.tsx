import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-cairo",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Ù†Ø¸Ø§Ù… Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„ØªØ±ÙˆÙŠØ¬ÙŠ",
  description: "Ù†Ø¸Ø§Ù… Ø¥Ø¯Ø§Ø±Ø© Ù…Ø®Ø²ÙˆÙ† Ø§Ù„Ù‡Ø¯Ø§ÙŠØ§ Ø§Ù„ØªØ±ÙˆÙŠØ¬ÙŠØ© ÙˆØªÙˆØ²ÙŠØ¹Ù‡Ø§ Ø¹Ù„Ù‰ ÙØ±Ù‚ Ø§Ù„ØªØ±ÙˆÙŠØ¬",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={cn(cairo.variable, "font-sans antialiased")}>
        {children}
      </body>
    </html>
  );
}
