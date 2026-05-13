import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avi Snow's Hit Maker",
  description:
    "Generate Suno-ready prompts calibrated against Avi Snow's 250M+ stream catalog — every parameter mapped to real Spotify hit data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
