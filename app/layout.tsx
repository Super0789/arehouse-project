import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const APP_TITLE =
  "\u0646\u0638\u0627\u0645 \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u062a\u0631\u0648\u064a\u062c\u064a";
const APP_DESCRIPTION =
  "\u0646\u0638\u0627\u0645 \u0625\u062f\u0627\u0631\u0629 \u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0647\u062f\u0627\u064a\u0627 \u0627\u0644\u062a\u0631\u0648\u064a\u062c\u064a\u0629 \u0648\u062a\u0648\u0632\u064a\u0639\u0647\u0627 \u0639\u0644\u0649 \u0641\u0631\u0642 \u0627\u0644\u062a\u0631\u0648\u064a\u062c";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-cairo",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_DESCRIPTION,
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
