import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ORIGEN Biomassa",
  description: "Sistema de rastreabilidade e classificação de biomassa",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
