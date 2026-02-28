import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RealEstate AI Agent",
  description: "AI-powered real estate assistant – schematics, reports & market insights",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
