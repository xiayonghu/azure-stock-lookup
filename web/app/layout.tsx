import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Lookup",
  description: "Look up stock price history",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
