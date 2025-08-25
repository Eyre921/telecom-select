"use client";

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

// 将使用 useSearchParams 的逻辑分离到单独的组件中
function SignInForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    // 获取登录成功后需要跳转的页面，默认为后台仪表盘
    const callbackUrl = searchParams.get('callbackUrl') || '/admin/dashboard';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const result = await signIn('credentials', {
                redirect: false, // 我们将手动处理跳转
                email,
                password,
                callbackUrl,
            });

            if (result?.error) {
                setError('账号或密码错误，请重试。');
                setIsLoading(false);
            } else if (result?.ok) {
                // 登录成功，跳转到目标页面
                router.push(callbackUrl);
            }
        } catch (err: unknown) {
            console.error('Sign in error:', err);
            setError('发生未知错误，请稍后重试。');
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
            <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
                管理后台登录
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="rounded-md bg-red-50 p-4">
                        <div className="text-sm text-red-700">{error}</div>
                    </div>
                )}
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        邮箱地址
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                        placeholder="请输入邮箱地址"
                    />
                </div>
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        密码
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                        placeholder="请输入密码"
                    />
                </div>
                <div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isLoading ? '登录中...' : '登录'}
                    </button>
                </div>
            </form>
        </div>
    );
}

// 主页面组件，使用 Suspense 包装
export default function SignInPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
            <Suspense fallback={
                <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
                    <div className="animate-pulse">
                        <div className="h-8 bg-gray-200 rounded mb-6"></div>
                        <div className="space-y-4">
                            <div className="h-4 bg-gray-200 rounded"></div>
                            <div className="h-10 bg-gray-200 rounded"></div>
                            <div className="h-4 bg-gray-200 rounded"></div>
                            <div className="h-10 bg-gray-200 rounded"></div>
                            <div className="h-10 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                </div>
            }>
                <SignInForm />
            </Suspense>
        </div>
    );
}
