import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prism",
  description:
    "Dashboard interno para visibilizar el estado de proyectos de Jira a audiencias no técnicas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // GeistSans.className sets the font-family directly (so prose inherits
  // Geist by default, no opt-in needed). GeistMono.variable exposes a
  // CSS variable (`--font-geist-mono`) for spots that need monospace —
  // applied via Tailwind's `font-mono` utility once we wire that mapping.
  return (
    <html
      lang="es"
      className={`${GeistSans.className} ${GeistMono.variable}`}
    >
      <body className="bg-bg text-text-primary antialiased">{children}</body>
    </html>
  );
}
