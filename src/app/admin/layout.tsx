import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

// 这是一个会话提供者组件，用于在客户端组件中访问会话
import SessionProvider from '@/components/providers/SessionProvider';

export default async function AdminLayout({
                                              children,
                                          }: {
    children: ReactNode;
}) {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/api/auth/signin"); // 如果未登录，重定向到登录页面
    }

    return (
        <SessionProvider session={session}>
            <div className="bg-gray-100 min-h-screen">
                {/* 在这里可以添加后台的导航栏或侧边栏 */}
                <header className="bg-white shadow-sm">
                    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
                        <h1 className="text-lg leading-6 font-semibold text-gray-900">
                            校园卡管理后台
                        </h1>
                    </div>
                </header>
                <main>
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </SessionProvider>
    );
}
