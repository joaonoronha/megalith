import type { Metadata, Viewport } from "next";
import "./globals.css";
import TopProgressBar from "@/components/TopProgressBar";

export const metadata: Metadata = {
  title: "EventFlow — CFM Eventos",
  description: "Plataforma de gestão operacional, orçamentos e inventário para a CFM Eventos",
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
