import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Isthihaaru – Ad post maker",
  description: "Turn a phone photo of your product into a professional advertisement post in seconds.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b6b2f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,600;1,700&family=Noto+Sans+Thaana:wght@400;500;600;700&family=Kaushan+Script&display=swap"
        />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
