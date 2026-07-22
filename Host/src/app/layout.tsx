import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FakePortainer - Central Control Plane",
  description: "Lightweight Docker Container Management GUI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
