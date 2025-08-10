import type { Metadata } from "next";
import "./globals.css";

// We have removed the font import from 'next/font/google'
// to prevent any external network calls.

export const metadata: Metadata = {
    title: "校园卡在线选号系统",
    description: "由Next.js驱动的校园卡在线选号系统",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN">
        {/* The `className` from the font object has been removed from the <body> tag.
        The application will now use the default system fonts defined in globals.css.
      */}
        <body>{children}</body>
        </html>
    );
}
