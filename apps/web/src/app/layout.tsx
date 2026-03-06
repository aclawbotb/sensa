import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const serif = Cormorant_Garamond({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = Inter({
  variable: "--font-ui-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sensa",
  description: "Feel your way to the right place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${serif.variable} ${sans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
