"use client";

import {useEffect, useState} from 'react';

// 定义统计数据的类型
interface StatsData {
    totalNumbers: number;
    availableNumbers: number;
    pendingReview: number;
    newOrdersToday: number;
}

interface StatsCardsProps {
    selectedSchoolId?: string;
    selectedDepartmentId?: string;
}

// 圆环图组件
const CircularProgress = ({ total, selected, isLoading }: { total: number; selected: number; isLoading: boolean }) => {
    const percentage = total > 0 ? (selected / total) * 100 : 0;
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    if (isLoading) {
        return (
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 mb-4">号码使用情况</h3>
                <div className="flex items-center justify-center">
                    <div className="w-32 h-32 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-4">号码使用情况</h3>
            <div className="flex items-center justify-center">
                <div className="relative w-32 h-32">
                    {/* 背景圆环 */}
                    <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke="#e5e7eb"
                            strokeWidth="8"
                            fill="transparent"
                        />
                        {/* 进度圆环 */}
                        <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke="#3b82f6"
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-in-out"
                        />
                    </svg>
                    {/* 中心文字 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-2xl font-bold text-gray-900">{selected}</div>
                        <div className="text-xs text-gray-500">已选</div>
                        <div className="text-xs text-gray-400">/ {total}</div>
                    </div>
                </div>
            </div>
            {/* 底部说明 */}
            <div className="mt-4 flex justify-between text-sm">
                <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                    <span className="text-gray-600">已选: {selected}</span>
                </div>
                <div className="flex items-center">
                    <div className="w-3 h-3 bg-gray-300 rounded-full mr-2"></div>
                    <span className="text-gray-600">可选: {total - selected}</span>
                </div>
            </div>
            <div className="mt-2 text-center text-xs text-gray-500">
                使用率: {percentage.toFixed(1)}%
            </div>
        </div>
    );
};

// 单个统计卡片组件
const StatCard = ({title, value, isLoading}: { title: string; value: number; isLoading: boolean }) => (
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
export const StatsCards = ({ selectedSchoolId, selectedDepartmentId }: StatsCardsProps) => {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setIsLoading(true);
                const params = new URLSearchParams();
                if (selectedSchoolId) {
                    params.append('schoolId', selectedSchoolId);
                }
                if (selectedDepartmentId) {
                    params.append('departmentId', selectedDepartmentId);
                }
                
                const response = await fetch(`/api/admin/stats?${params.toString()}`);
                if (!response.ok) {
                    throw new Error('获取统计数据失败');
                }
                const data = await response.json();
                setStats(data);
            } catch (err: unknown) {
                console.error('Error:', err);
                const errorMessage = err instanceof Error ? err.message : '统计数据加载失败';
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, [selectedSchoolId, selectedDepartmentId]);

    if (error) {
        return <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg mb-6">{error}</div>;
    }

    const selectedNumbers = (stats?.totalNumbers ?? 0) - (stats?.availableNumbers ?? 0);

    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            <CircularProgress 
                total={stats?.totalNumbers ?? 0} 
                selected={selectedNumbers} 
                isLoading={isLoading}
            />
            <StatCard title="待审核订单" value={stats?.pendingReview ?? 0} isLoading={isLoading}/>
            <StatCard title="今日新增订单" value={stats?.newOrdersToday ?? 0} isLoading={isLoading}/>
        </div>
    );
};
