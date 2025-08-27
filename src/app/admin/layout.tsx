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
  const session = await getServerSession(authOptions);

  // 1. 检查用户是否登录
  if (!session?.user) {
    redirect("/signin?callbackUrl=/admin/dashboard");
  }

  // 2. 修复：使用正确的角色检查
  const userRole = session.user.role;
  const authorized = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'MARKETER'].includes(userRole);

  if (!authorized) {
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
