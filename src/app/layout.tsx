import type { Metadata } from "next";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Atlas / Places",
    template: "%s | Atlas",
  },
  description: "Explore country facts, connections, and coordinates with Atlas.",
  applicationName: "Atlas",
  keywords: ["countries", "world atlas", "country facts", "interactive globe", "geography"],
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Atlas / Places",
    description: "Explore country facts, connections, and coordinates with Atlas.",
    type: "website",
    siteName: "Atlas",
  },
  twitter: {
    card: "summary",
    title: "Atlas / Places",
    description: "Explore country facts, connections, and coordinates with Atlas.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
