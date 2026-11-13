import type { Metadata, Viewport } from "next";
import "./globals.css";
import TopProgressBar from "@/components/TopProgressBar";

export const metadata: Metadata = {
  title: "CFM Events",
  description: "Plataforma de gestão operacional, orçamentos e inventário para a CFM Events",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#f8f8fa",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-[#f8f8fa] text-[#111111] antialiased">
        <TopProgressBar />
        {children}
      </body>
    </html>
  );
}
