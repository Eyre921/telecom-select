import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // 确保从 @/lib/auth 导入
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import SessionProvider from '@/components/providers/SessionProvider';

export default async function AdminLayout({
                                              children,
                                          }: {
    children: ReactNode;
}) {
    // getServerSession 现在会根据我们的类型定义文件，返回带有 role 的 session 对象
    const session = await getServerSession(authOptions);

    // 1. 检查用户是否登录
    if (!session?.user) {
        // 如果未登录，重定向到自定义登录页面，并附带回调地址
        redirect("/signin?callbackUrl=/admin/dashboard");
    }

    // 2. 关键修复: 直接从 session.user 中读取 role
    const userRole = session.user.role;
    const authorized = userRole === 'ADMIN' || userRole === 'MARKETER';

    if (!authorized) {
        // 如果角色不符，重定向到首页
        redirect("/");
    }

    return (
        <SessionProvider session={session}>
            <div className="bg-gray-100 min-h-screen">
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
