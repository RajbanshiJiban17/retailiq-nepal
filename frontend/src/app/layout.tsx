import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RetailIQ Nepal | Smart Inventory & Analytics",
  description:
    "FastAPI & Next.js full-stack platform optimized for low-budget high-performance retail management in Nepal.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full scroll-smooth">
      <body className="flex min-h-full flex-col bg-slate-950 text-slate-100 antialiased overflow-x-hidden w-full">
        {children}
      </body>
    </html>
  );
}

