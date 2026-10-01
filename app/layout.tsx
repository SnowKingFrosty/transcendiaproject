import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Transcendia - Delivery Dashboard",
  description: "Delivery tracking system for Transcendia",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
