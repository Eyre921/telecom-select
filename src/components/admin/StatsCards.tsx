"use client";

import { useEffect, useState } from 'react';

// 定义统计数据的类型
interface StatsData {
    totalNumbers: number;
    availableNumbers: number;
    pendingReview: number;
    newOrdersToday: number;
}

// 单个统计卡片组件
const StatCard = ({ title, value, isLoading }: { title: string; value: number; isLoading: boolean }) => (
    <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        {isLoading ? (
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mt-1"></div>
        ) : (
            <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
        )}
    </div>
);

// 统计卡片组组件
export const StatsCards = () => {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch('/api/admin/stats');
                if (!response.ok) {
                    throw new Error('获取统计数据失败');
                }
                const data = await response.json();
                setStats(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (error) {
        return <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg mb-6">{error}</div>;
    }

    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <StatCard title="总号码数" value={stats?.totalNumbers ?? 0} isLoading={isLoading} />
            <StatCard title="剩余可选" value={stats?.availableNumbers ?? 0} isLoading={isLoading} />
            <StatCard title="待审核订单" value={stats?.pendingReview ?? 0} isLoading={isLoading} />
            <StatCard title="今日新增订单" value={stats?.newOrdersToday ?? 0} isLoading={isLoading} />
        </div>
    );
};
