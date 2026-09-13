import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RetailIQ Nepal | Smart Inventory & Analytics",
  description:
    "FastAPI & Next.js full-stack platform optimized for low-budget high-performance retail management in Nepal.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
