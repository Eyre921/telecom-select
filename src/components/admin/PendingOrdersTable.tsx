"use client";

import {PhoneNumber} from '@prisma/client';
import {useEffect, useState} from 'react';

// 计算并格式化倒计时
const formatTimeLeft = (timestamp: string | Date): string => {
    const orderTime = new Date(timestamp).getTime();
    const now = new Date().getTime();
    const diffMinutes = Math.floor((now - orderTime) / (1000 * 60));

    if (diffMinutes >= 30) {
        return "已超时";
    }

    const timeLeft = 30 - diffMinutes;
    return `${timeLeft} 分钟后超时`;
};

interface PendingOrdersTableProps {
    onApprove: (number: PhoneNumber) => void;
    onRelease: (numberId: string) => void;
    selectedSchoolId?: string;
    selectedDepartmentId?: string;
}

export const PendingOrdersTable = ({onApprove, onRelease, selectedSchoolId, selectedDepartmentId}: PendingOrdersTableProps) => {
    const [pendingNumbers, setPendingNumbers] = useState<PhoneNumber[]>([]);
    const [releasingId, setReleasingId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPendingOrders = async () => {
            try {
                setIsLoading(true);
                const params = new URLSearchParams();
                if (selectedSchoolId) {
                    params.append('schoolId', selectedSchoolId);
                }
                if (selectedDepartmentId) {
                    params.append('departmentId', selectedDepartmentId);
                }
                
                const response = await fetch(`/api/admin/pending-orders?${params.toString()}`);
                if (response.ok) {
                    const data = await response.json();
                    setPendingNumbers(data);
                }
            } catch (err) {
                console.error('获取待审核订单失败:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPendingOrders();
    }, [selectedSchoolId, selectedDepartmentId]);

    const handleRelease = async (numberId: string) => {
        if (!confirm('确定要手动释放这个号码吗？资源将返还号码池。')) return;
        setReleasingId(numberId);
        try {
            // 这里我们假设父组件会处理API调用和状态更新
            onRelease(numberId);
        } catch (err: unknown) {
            console.error('Release error:', err);
            alert('释放失败，请刷新页面后重试。');
        } finally {
            setReleasingId(null);
        }
    };

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold text-gray-900">待审核订单</h2>
                <span className="text-sm text-gray-500">共 {pendingNumbers.length} 个订单</span>
            </div>
            
            {isLoading ? (
                <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                    <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                </div>
            ) : pendingNumbers.length === 0 ? (
                <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                    <p className="text-center text-gray-500">当前没有待审核的订单。</p>
                </div>
            ) : (
                <div className="bg-white shadow rounded-lg border border-gray-200">
                    {/* 固定高度的可滑动容器 */}
                    <div className="h-48 overflow-y-auto">
                        <div className="divide-y divide-gray-200">
                            {pendingNumbers.map((number) => (
                                <div key={number.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                                    {/* 响应式布局：窄设备上分两行显示 */}
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 sm:space-x-4 min-w-0">
                                        {/* 第一行/左侧：号码、状态和客户信息 */}
                                        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 flex-1 min-w-0">
                                            {/* 号码和状态 */}
                                            <div className="flex items-center space-x-3 flex-shrink-0">
                                                <span className="text-lg font-mono font-medium text-indigo-600">
                                                    {number.phoneNumber}
                                                </span>
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                                                    new Date(number.orderTimestamp!).getTime() < Date.now() - 30 * 60 * 1000 
                                                        ? 'bg-red-100 text-red-800' 
                                                        : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {formatTimeLeft(number.orderTimestamp!)}
                                                </span>
                                            </div>
                                            
                                            {/* 客户信息 */}
                                            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 flex-1 min-w-0">
                                                <span className="text-sm text-gray-700 font-medium">
                                                    {number.customerName}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {number.customerContact}
                                                </span>
                                                {number.paymentAmount && (
                                                    <span className="text-sm text-green-600 font-medium whitespace-nowrap">
                                                        ¥{number.paymentAmount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* 第二行/右侧：操作按钮 */}
                                        <div className="flex items-center space-x-2 flex-shrink-0 self-start sm:self-center">
                                            <button 
                                                onClick={() => onApprove(number)}
                                                className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
                                            >
                                                批准/编辑
                                            </button>
                                            <button
                                                onClick={() => handleRelease(number.id)}
                                                disabled={releasingId === number.id}
                                                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:text-gray-400 disabled:hover:bg-transparent"
                                            >
                                                {releasingId === number.id ? '释放中...' : '手动释放'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* 底部提示 */}
                    {pendingNumbers.length > 3 && (
                        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-center">
                            <span className="text-xs text-gray-500">向上滑动查看更多订单</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

