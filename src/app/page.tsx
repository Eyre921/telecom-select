"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PhoneNumber } from '@prisma/client';
import { NumberCard } from '@/components/ui/NumberCard';
import { OrderModal } from '@/components/ui/OrderModal';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';

// 加载动画组件 - 使用中国电信蓝色
const Spinner = () => (
    <div className="flex justify-center items-center py-10">
        <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin" style={{borderColor: '#1890FF', borderTopColor: 'transparent'}}></div>
    </div>
);

export default function HomePage() {
    const searchParams = useSearchParams();
    
    // 从URL参数获取过滤条件和销售人员信息
    const schoolId = searchParams.get('schoolId');
    const departmentId = searchParams.get('departmentId');
    const marketer = searchParams.get('marketer');
    
    const [allNumbers, setAllNumbers] = useState<PhoneNumber[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [organizationInfo, setOrganizationInfo] = useState<{
        schoolName?: string;
        departmentName?: string;
    }>({});
    
    // 新增：销售员真实姓名状态
    const [marketerRealName, setMarketerRealName] = useState<string | null>(null);

    // 状态管理
    const [searchTerm, setSearchTerm] = useState('');
    const [hideReserved, setHideReserved] = useState(true); // 默认隐藏已选号码，无UI控制
    const [selectedNumber, setSelectedNumber] = useState<PhoneNumber | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [logoLoadError, setLogoLoadError] = useState(false);

    // 当logoUrl改变时重置错误状态
    useEffect(() => {
        setLogoLoadError(false);
    }, []);

    // 无限滚动状态
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);

    const [reloadTrigger, setReloadTrigger] = useState(0);

    // 获取组织信息
    const fetchOrganizationInfo = useCallback(async () => {
        if (!schoolId && !departmentId) return;
        
        try {
            const promises = [];
            
            if (schoolId) {
                promises.push(
                    fetch(`/api/admin/organizations/${schoolId}`)
                        .then(res => res.ok ? res.json() : null)
                        .then(data => ({ schoolName: data?.name }))
                );
            }
            
            if (departmentId) {
                promises.push(
                    fetch(`/api/admin/organizations/${departmentId}`)
                        .then(res => res.ok ? res.json() : null)
                        .then(data => ({ departmentName: data?.name }))
                );
            }
            
            const results = await Promise.all(promises);
            const info = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
            setOrganizationInfo(info);
        } catch (error) {
            console.error('获取组织信息失败:', error);
        }
    }, [schoolId, departmentId]);

    // 数据获取函数
    // 获取marketer的组织信息并自动设置schoolId
    const fetchMarketerInfo = useCallback(async () => {
        if (!marketer) return null;
        
        try {
            // 调用API获取marketer的组织信息
            const response = await fetch(`/api/marketer-info?marketer=${encodeURIComponent(marketer)}`);
            if (!response.ok) return null;
            
            const marketerData = await response.json();
            
            // 存储销售员的真实姓名
            if (marketerData.marketer && marketerData.marketer.name) {
                setMarketerRealName(marketerData.marketer.name);
            }
            
            // 如果marketer只有一个学校权限，返回该学校ID
            if (marketerData.schools && marketerData.schools.length === 1) {
                return {
                    autoSchoolId: marketerData.schools[0].id,
                    autoSchoolName: marketerData.schools[0].name,
                    marketerName: marketerData.marketer.name
                };
            }
            
            return {
                marketerName: marketerData.marketer.name
            };
        } catch (error) {
            console.error('获取marketer信息失败:', error);
            return null;
        }
    }, [marketer]);

    // 修改fetchData函数，在开始时检查marketer信息
    const fetchData = useCallback(async () => {
        if (isLoading || !hasMore) return;
    
        setIsLoading(true);
        setError(null);
    
        try {
            // 如果是第一页且有marketer参数，先获取marketer信息
            let autoSchoolId = schoolId;
            let autoSchoolName = organizationInfo.schoolName;
            
            if (page === 1 && marketer) {
                const marketerInfo = await fetchMarketerInfo();
                if (marketerInfo) {
                    if (marketerInfo.autoSchoolId && !schoolId) {
                        autoSchoolId = marketerInfo.autoSchoolId;
                        autoSchoolName = marketerInfo.autoSchoolName;
                        
                        // 更新组织信息状态
                        setOrganizationInfo(prev => ({
                            ...prev,
                            schoolName: autoSchoolName
                        }));
                    }
                }
            }
            
            const params = new URLSearchParams({
                page: String(page),
                hideReserved: String(hideReserved),
            });
            
            // 添加过滤参数
            if (autoSchoolId) params.append('schoolId', autoSchoolId);
            if (departmentId) params.append('departmentId', departmentId);
            // 添加marketer参数
            if (marketer) params.append('marketer', marketer);
            
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
    }, [page, hasMore, isLoading, hideReserved, schoolId, departmentId, marketer, fetchMarketerInfo, organizationInfo.schoolName]);

    // 当"屏蔽已选"状态改变时，触发重置
    const handleHideReservedToggle = () => {
        setHideReserved(prev => !prev);
        setAllNumbers([]);
        setPage(1);
        setHasMore(true);
        setReloadTrigger(t => t + 1);
    };

    // 初始加载组织信息
    useEffect(() => {
        fetchOrganizationInfo();
    }, [fetchOrganizationInfo]);

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

    // 生成标题文本
    const getPageTitle = () => {
        const parts = [];
        if (organizationInfo.schoolName) {
            parts.push(organizationInfo.schoolName);
        }
        if (organizationInfo.departmentName) {
            parts.push(organizationInfo.departmentName);
        }
        
        if (parts.length > 0) {
            return `${parts.join(' - ')} 专属选号`;
        }
        return '🔍 开始选号';
    };

    const getPageSubtitle = () => {
        if (organizationInfo.schoolName || organizationInfo.departmentName) {
            return '为您筛选专属号码资源';
        }
        return '从下方号码库中选择您心仪的专属号码';
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
            {/* 顶部品牌横幅 - 扩展版本 */}
            <div className="telecom-gradient text-white py-16 md:py-24 relative overflow-hidden">
                {/* 背景装饰 */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-32 h-32 border border-white rounded-full"></div>
                    <div className="absolute bottom-10 right-10 w-24 h-24 border border-white rounded-full"></div>
                    <div className="absolute top-1/2 left-1/4 w-16 h-16 border border-white rounded-full"></div>
                </div>
                
                <div className="container mx-auto px-4 md:px-8 relative z-10">
                    {/* 主标题区域 */}
                    <div className="text-center mb-12">
                        <div className="flex items-center justify-center space-x-4 mb-6">
                            {/* Logo图片占位符 - 如果没有提供logo链接就显示默认图标 */}
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                                {(() => {
                                    const logoUrl = "https://tc.nfeyre.top/i/2025/08/27/ugw9o1.png"; // 在这里设置logo图片链接
                                    const showFallback = !logoUrl || logoLoadError;
                                    
                                    return (
                                        <>
                                            {logoUrl && !logoLoadError && (
                                                <Image 
                                                    src={logoUrl} 
                                                    alt="中国电信Logo" 
                                                    width={40}
                                                    height={40}
                                                    className="object-contain" 
                                                    onError={() => setLogoLoadError(true)}
                                                />
                                            )}
                                            {showFallback && (
                                                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 2.5c0 .83-.67 1.5-1.5 1.5S12 7.33 12 6.5 12.67 5 13.5 5s1.5.67 1.5 1.5zM12 13c-2.33 0-4.31 1.46-5.11 3.5h10.22c-.8-2.04-2.78-3.5-5.11-3.5z"/>
                                                </svg>
                                            )}
                                        </>
                                    );
                                })()} 
                            </div>
                            <div>
                                <h1 className="text-3xl md:text-5xl font-bold">中国电信</h1>
                                <p className="text-blue-100 text-lg md:text-xl">校园卡在线选号系统</p>
                            </div>
                        </div>
                        
                        {/* 介绍内容 */}
                        <div className="max-w-4xl mx-auto px-4">
                            <div className="text-center">
                                <p className="text-blue-50 text-base md:text-xl leading-relaxed mb-6">
                                    🎓 专为校园用户打造的智能选号平台，提供海量号码实时更新、一键筛选心仪号码、官方认证安全保障，支持定金预定和全款直购两种灵活支付方式，为您的校园生活开启智能通信新体验。
                                </p>
                                <p className="text-blue-200 text-xs md:text-base">下滑开始选择您的专属号码 ↓</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* 底部渐变过渡，创建平滑的视觉连接 */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-blue-50/80 via-blue-100/40 to-transparent"></div>
            </div>

            {/* 选号区域 - 与顶部区域有重叠效果，露出第一行号码 */}
            <div className="container mx-auto p-4 md:p-8 -mt-32 md:-mt-40 relative z-20">
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

                <header className="text-center mb-6 bg-white/90 backdrop-blur-sm rounded-2xl p-4 md:p-6 telecom-card-shadow">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">{getPageTitle()}</h2>
                    <p className="text-gray-600 text-sm md:text-base">{getPageSubtitle()}</p>
                    {(organizationInfo.schoolName || organizationInfo.departmentName) && (
                        <div className="mt-3 inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            已为您筛选专属号码
                        </div>
                    )}
                </header>

                {/* 搜索区域 - 使用中国电信风格 */}
                <div className="bg-white/95 backdrop-blur-sm p-4 md:p-6 rounded-xl telecom-card-shadow mb-6 sticky top-4 z-40 border border-blue-100">
                    <div className="relative w-full">
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

                {/* 号码网格 - 优化间距和响应式布局 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
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
                marketer={marketerRealName || marketer} // 优先使用真实姓名，fallback到URL参数
                organizationInfo={organizationInfo}
            />
        </main>
    );
}
