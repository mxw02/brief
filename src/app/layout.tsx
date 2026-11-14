import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brief — Open Source Knowledge Base",
  description: "Self-hosted, open-source alternative to Confluence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FAFAFA] text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
