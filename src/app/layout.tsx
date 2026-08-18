import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/ThemeScript";
import { PwaRegister } from "@/components/PwaRegister";
import { OfflineIndicator } from "@/components/OfflineIndicator";

export const metadata: Metadata = {
  title: "Rekap Penjualan Rajaklana",
  description: "Sistem Rekapitulasi & Analisis Penjualan Abon Gulung Rajaklana",
  manifest: "/manifest.json",
  applicationName: "Rekap Penjualan Rajaklana",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rajaklana"
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#b91c1c"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <PwaRegister />
        <OfflineIndicator />
      </body>
    </html>
  );
}
