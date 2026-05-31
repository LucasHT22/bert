import React from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bert",
  description: "Frame it perfectly"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
    <html lang="en">
      <body>
        <div className="grain" />
        {children}
      </body>
    </html>
    </>
  );
}
