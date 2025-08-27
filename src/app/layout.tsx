import type {Metadata} from "next";
import "./globals.css";
import SessionProvider from '@/components/providers/SessionProvider';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// We have removed the font import from 'next/font/google'
// to prevent any external network calls.

export const metadata: Metadata = {
    title: "电信校园卡在线选号系统",
    description: "由Next.js驱动的校园卡在线选号系统，Eyre制作，欢迎使用",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await getServerSession(authOptions);
    
    return (
        <html lang="zh-CN">
        <head>
            <meta name="format-detection" content="telephone=no, date=no, email=no, address=no" />
        </head>
        <body suppressHydrationWarning={true}>
            <SessionProvider session={session}>
                {children}
            </SessionProvider>
        </body>
        </html>
    );
}
