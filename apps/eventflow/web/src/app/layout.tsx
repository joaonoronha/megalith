import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EventFlow — CFM Eventos",
  description: "Plataforma de gestão operacional, orçamentos e inventário para a CFM Eventos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-[#f8f8fa] text-[#111111] antialiased">
        {children}
      </body>
    </html>
  );
}
