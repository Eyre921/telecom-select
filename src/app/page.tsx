"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {PhoneNumber} from '@prisma/client';
import {NumberCard} from '@/components/ui/NumberCard';
import {OrderModal} from '@/components/ui/OrderModal';

// 加载动画组件
const Spinner = () => (
    <div className="flex justify-center items-center py-10">
        <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-blue-500"></div>
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

    // 用于触发重新加载的 state
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
                // **关键修复**: 过滤掉已存在的号码，防止重复key
                setAllNumbers(prev => {
                    const existingIds = new Set(prev.map(n => n.id));
                    const uniqueNewNumbers = newNumbers.filter((n: PhoneNumber) => !existingIds.has(n.id));
                    return [...prev, ...uniqueNewNumbers];
                });
                setPage(prev => prev + 1);
            }
        } catch (err: any) {
            setError(err.message);
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
        setReloadTrigger(t => t + 1); // 改变这个值来触发下面的 effect
    };

    // 初始加载或触发重载时运行
    useEffect(() => {
        fetchData();
    }, [reloadTrigger]);


    // Intersection Observer 用于检测用户是否滚动到底部
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isLoading && hasMore) {
                    fetchData();
                }
            },
            {threshold: 1.0}
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

    const handleOrderSuccess = () => {
        handleCloseModal();
        setShowSuccessMessage(true);
        // 订单成功后，重置状态并重新加载数据
        setAllNumbers([]);
        setPage(1);
        setHasMore(true);
        setReloadTrigger(t => t + 1);
        setTimeout(() => {
            setShowSuccessMessage(false);
        }, 5000);
    };

    return (
        <main className="container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
            {showSuccessMessage && (
                <div
                    className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-md shadow-lg animate-in fade-in-50"
                    role="alert">
                    <p className="font-bold">预定成功!</p>
                    <p>您的号码已临时锁定。请根据页面提示完成支付并联系销售人员确认。</p>
                </div>
            )}

            <header className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">校园卡在线选号</h1>
                <p className="mt-2 text-gray-600">请选择您心仪的号码</p>
            </header>

            <div className="bg-white p-4 rounded-lg shadow-md mb-8 sticky top-4 z-40">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <input
                        type="text"
                        placeholder="在当前已加载号码中搜索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center justify-center">
                        <label className="flex items-center cursor-pointer select-none">
              <span className="mr-3 text-gray-700 font-medium">
                一键屏蔽已选
              </span>
                            <div className="relative">
                                <input type="checkbox" className="sr-only" checked={hideReserved}
                                       onChange={handleHideReservedToggle}/>
                                <div
                                    className={`block w-14 h-8 rounded-full transition-colors ${hideReserved ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                                <div
                                    className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${hideReserved ? 'transform translate-x-full' : ''}`}></div>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {error && <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</div>}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredNumbers.map(number => (
                    <NumberCard key={number.id} number={number} onClick={handleCardClick}/>
                ))}
            </div>

            <div ref={loaderRef} className="col-span-full h-10">
                {isLoading && <Spinner/>}
            </div>

            {!isLoading && !hasMore && allNumbers.length > 0 && (
                <p className="col-span-full text-center text-gray-500 py-10">已加载全部号码</p>
            )}

            {!isLoading && allNumbers.length === 0 && !error && (
                <p className="col-span-full text-center text-gray-500 py-10">当前暂无可选择的号码。</p>
            )}

            <OrderModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                number={selectedNumber}
                onOrderSuccess={handleOrderSuccess}
            />
        </main>
    );
}
