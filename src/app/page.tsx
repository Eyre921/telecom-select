"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PhoneNumber } from '@prisma/client';
import { NumberCard } from '@/components/ui/NumberCard';
import { OrderModal } from '@/components/ui/OrderModal';

// 加载动画组件 - 使用中国电信蓝色
const Spinner = () => (
    <div className="flex justify-center items-center py-10">
        <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin" style={{borderColor: '#1890FF', borderTopColor: 'transparent'}}></div>
    </div>
);

export default function HomePage() {
    const [allNumbers, setAllNumbers] = useState<PhoneNumber[]>([]);
    const [error, setError] = useState<string | null>(null);

    // 状态管理
    const [searchTerm, setSearchTerm] = useState('');
    const [hideReserved, setHideReserved] = useState(true);
    const [selectedNumber, setSelectedNumber] = useState<PhoneNumber | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

    // 无限滚动状态
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);

    const [reloadTrigger, setReloadTrigger] = useState(0);

    // 数据获取函数
    const fetchData = useCallback(async () => {
        if (isLoading || !hasMore) return;

        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                page: String(page),
                hideReserved: String(hideReserved),
            });
            const response = await fetch(`/api/numbers?${params.toString()}`);

            if (!response.ok) {
                throw new Error('获取号码列表失败，请稍后重试');
            }
            const newNumbers = await response.json();

            if (newNumbers.length === 0) {
                setHasMore(false);
            } else {
                setAllNumbers(prev => {
                    const existingIds = new Set(prev.map(n => n.id));
                    const uniqueNewNumbers = newNumbers.filter((n: PhoneNumber) => !existingIds.has(n.id));
                    return [...prev, ...uniqueNewNumbers];
                });
                setPage(prev => prev + 1);
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : '获取数据失败';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [page, hasMore, isLoading, hideReserved]);

    // 当“屏蔽已选”状态改变时，触发重置
    const handleHideReservedToggle = () => {
        setHideReserved(prev => !prev);
        setAllNumbers([]);
        setPage(1);
        setHasMore(true);
        setReloadTrigger(t => t + 1);
    };

    // 初始加载或触发重载时运行
    useEffect(() => {
        fetchData();
    }, [fetchData, reloadTrigger]);


    // Intersection Observer 用于检测用户是否滚动到底部
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isLoading && hasMore) {
                    fetchData();
                }
            },
            { threshold: 1.0 }
        );

        const currentLoader = loaderRef.current;
        if (currentLoader) {
            observer.observe(currentLoader);
        }

        return () => {
            if (currentLoader) {
                observer.unobserve(currentLoader);
            }
        };
    }, [isLoading, hasMore, fetchData]);

    // 客户端的搜索功能
    const filteredNumbers = useMemo(() => {
        if (!searchTerm) return allNumbers;
        return allNumbers.filter(number =>
            number.phoneNumber.includes(searchTerm.trim())
        );
    }, [allNumbers, searchTerm]);

    // 事件处理函数
    const handleCardClick = (number: PhoneNumber) => {
        setSelectedNumber(number);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedNumber(null);
    };

    // **关键修复**: 移除了 handleCloseModal() 的调用
    const handleOrderSuccess = () => {
        // 订单成功后，不再关闭弹窗，而是让弹窗内部自己切换视图
        setShowSuccessMessage(true); // 这个消息会在弹窗关闭后显示在主页面上

        // 在后台刷新数据
        setAllNumbers([]);
        setPage(1);
        setHasMore(true);
        setReloadTrigger(t => t + 1);

        setTimeout(() => {
            setShowSuccessMessage(false);
        }, 5000);
    };

    return (
        <main className="min-h-screen" style={{background: 'linear-gradient(135deg, #f8fafc 0%, #e6f4ff 100%)'}}>
            {/* 顶部品牌横幅 */}
            <div className="telecom-gradient text-white py-6 mb-8">
                <div className="container mx-auto px-4 md:px-8">
                    <div className="flex items-center justify-center space-x-4">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 2.5c0 .83-.67 1.5-1.5 1.5S12 7.33 12 6.5 12.67 5 13.5 5s1.5.67 1.5 1.5zM12 13c-2.33 0-4.31 1.46-5.11 3.5h10.22c-.8-2.04-2.78-3.5-5.11-3.5z"/>
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold">中国电信</h1>
                            <p className="text-blue-100 text-sm md:text-base">校园卡在线选号系统</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto p-4 md:p-8">
                {showSuccessMessage && (
                    <div className="bg-green-50 border-l-4 border-green-400 text-green-800 p-4 mb-6 rounded-md telecom-card-shadow animate-in fade-in-50" role="alert">
                        <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className="font-semibold">预定成功!</p>
                                <p className="text-sm">您的号码已临时锁定。请根据页面提示完成支付并联系销售人员确认。</p>
                            </div>
                        </div>
                    </div>
                )}

                <header className="text-center mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">选择您心仪的号码</h2>
                    <p className="text-gray-600">为您的校园生活选择一个专属号码</p>
                </header>

                {/* 搜索和筛选区域 - 使用中国电信风格 */}
                <div className="bg-white p-6 rounded-xl telecom-card-shadow mb-8 sticky top-4 z-40 border border-blue-100">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative w-full md:flex-1">
                            <input
                                type="text"
                                placeholder="在当前已加载号码中搜索..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-4 pl-12 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                            <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <div className="flex items-center justify-center">
                            <label className="flex items-center cursor-pointer select-none">
                                <span className="mr-3 text-gray-700 font-medium">一键屏蔽已选</span>
                                <div className="relative">
                                    <input type="checkbox" className="sr-only" checked={hideReserved} onChange={handleHideReservedToggle} />
                                    <div className={`block w-14 h-8 rounded-full transition-colors ${
                                        hideReserved ? 'bg-blue-500' : 'bg-gray-300'
                                    }`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform shadow-md ${
                                        hideReserved ? 'transform translate-x-full' : ''
                                    }`}></div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="text-center text-red-600 bg-red-50 p-4 rounded-lg border border-red-200 mb-6">
                        <div className="flex items-center justify-center">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredNumbers.map(number => (
                        <NumberCard key={number.id} number={number} onClick={handleCardClick} />
                    ))}
                </div>

                <div ref={loaderRef} className="col-span-full h-10">
                    {isLoading && <Spinner />}
                </div>

                {!isLoading && !hasMore && allNumbers.length > 0 && (
                    <div className="text-center py-10">
                        <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-full">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            已加载全部号码
                        </div>
                    </div>
                )}

                {!isLoading && allNumbers.length === 0 && !error && (
                    <div className="text-center py-20">
                        <div className="text-gray-400 mb-4">
                            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                        </div>
                        <p className="text-gray-500 text-lg">当前暂无可选择的号码</p>
                        <p className="text-gray-400 text-sm mt-2">请稍后再试或联系客服</p>
                    </div>
                )}
            </div>

            <OrderModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                number={selectedNumber}
                onOrderSuccess={handleOrderSuccess}
            />
        </main>
    );
}
