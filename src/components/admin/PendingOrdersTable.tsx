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
    initialPendingNumbers: PhoneNumber[];
    onApprove: (number: PhoneNumber) => void; // 用于通知父组件有订单被批准
    onRelease: (numberId: string) => void; // 用于通知父组件有订单被释放
}

export const PendingOrdersTable = ({initialPendingNumbers, onApprove, onRelease}: PendingOrdersTableProps) => {
    const [pendingNumbers, setPendingNumbers] = useState(initialPendingNumbers);
    const [releasingId, setReleasingId] = useState<string | null>(null);

    // 允许父组件更新列表
    useEffect(() => {
        setPendingNumbers(initialPendingNumbers);
    }, [initialPendingNumbers]);

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
            <h2 className="text-xl font-semibold text-gray-900 mb-4">待审核订单</h2>
            {pendingNumbers.length === 0 ? (
                <p className="text-center text-gray-500 bg-white p-6 rounded-lg shadow">当前没有待审核的订单。</p>
            ) : (
                <div className="bg-white shadow overflow-hidden rounded-md">
                    <ul role="list" className="divide-y divide-gray-200">
                        {pendingNumbers.map((number) => (
                            <li key={number.id}>
                                <div className="block hover:bg-gray-50 px-4 py-4 sm:px-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-lg font-mono font-medium text-indigo-600 truncate">{number.phoneNumber}</p>
                                        <div className="ml-2 flex-shrink-0 flex">
                                            <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${new Date(number.orderTimestamp!).getTime() < Date.now() - 30 * 60 * 1000 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {formatTimeLeft(number.orderTimestamp!)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 sm:flex sm:justify-between">
                                        <div className="sm:flex">
                                            <p className="flex items-center text-sm text-gray-500 mr-6">
                                                {number.customerName}
                                            </p>
                                            <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                                {number.customerContact}
                                            </p>
                                        </div>
                                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 space-x-4">
                                            <button onClick={() => onApprove(number)}
                                                    className="font-medium text-indigo-600 hover:text-indigo-500">
                                                批准/编辑
                                            </button>
                                            <button
                                                onClick={() => handleRelease(number.id)}
                                                disabled={releasingId === number.id}
                                                className="font-medium text-red-600 hover:text-red-500 disabled:text-gray-400"
                                            >
                                                {releasingId === number.id ? '释放中...' : '手动释放'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

