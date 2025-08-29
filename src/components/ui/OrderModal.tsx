"use client";

import { useState, useEffect } from 'react';
import { PhoneNumber } from '@prisma/client';
import Image from 'next/image';

interface OrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    number: PhoneNumber | null;
    onOrderSuccess: () => void;
    marketer?: string | null;
    organizationInfo?: {
        schoolName?: string;
        departmentName?: string;
    };
}

// 新增：订单数据类型接口
interface OrderData {
    numberId: string;
    paymentAmount: number;
    customerName: string;
    customerContact: string;
    shippingAddress?: string;
    assignedMarketer?: string;
}

export const OrderModal = ({ isOpen, onClose, number, onOrderSuccess, marketer, organizationInfo }: OrderModalProps) => {
    // 移除硬编码的DEFAULT_QR_CODE_URL
    // const DEFAULT_QR_CODE_URL = "https://i.imgs.ovh/2025/08/11/EBUpM.png";

    // 表单状态
    const [paymentOption, setPaymentOption] = useState<20 | 200>(20);
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [shippingAddress, setShippingAddress] = useState('');

    // UI 状态
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [orderSubmitted, setOrderSubmitted] = useState(false);
    
    // 收款码相关状态
    const [paymentQrCode, setPaymentQrCode] = useState<string | null>(null);
    const [isLoadingQr, setIsLoadingQr] = useState(false);
    const [systemDefaultQr, setSystemDefaultQr] = useState<string | null>(null);
    const [hasSystemConfig, setHasSystemConfig] = useState(false);
    // 新增：收款码来源状态
    const [qrCodeSource, setQrCodeSource] = useState<'marketer' | 'system' | 'none'>('none');

    // 获取系统默认收款码的函数
    const fetchSystemDefaultQr = async () => {
        try {
            const response = await fetch('/api/admin/system-config');
            if (response.ok) {
                const data = await response.json();
                if (data.defaultPaymentQr) {
                    setSystemDefaultQr(data.defaultPaymentQr);
                    setHasSystemConfig(true);
                } else {
                    setSystemDefaultQr(null);
                    setHasSystemConfig(false);
                }
            } else {
                setSystemDefaultQr(null);
                setHasSystemConfig(false);
            }
        } catch (error) {
            console.error('获取系统默认收款码失败:', error);
            setSystemDefaultQr(null);
            setHasSystemConfig(false);
        }
    };
    
    // 在组件挂载时获取系统默认收款码
    useEffect(() => {
        fetchSystemDefaultQr();
    }, []);
    
    // 获取销售员信息和二维码的函数
    const fetchMarketerInfo = async (marketerName: string) => {
        try {
            setIsLoadingQr(true);
            const response = await fetch(`/api/marketer-info?marketer=${encodeURIComponent(marketerName)}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.marketer?.paymentQrCode) {
                    setPaymentQrCode(data.marketer.paymentQrCode);
                    setQrCodeSource('marketer');
                } else {
                    // 如果销售员没有设置二维码，使用系统默认二维码
                    setPaymentQrCode(systemDefaultQr);
                    setQrCodeSource(systemDefaultQr ? 'system' : 'none');
                }
            } else {
                // API调用失败，使用系统默认二维码
                setPaymentQrCode(systemDefaultQr);
                setQrCodeSource(systemDefaultQr ? 'system' : 'none');
            }
        } catch (error) {
            console.error('获取销售员信息失败:', error);
            // 出错时使用系统默认二维码
            setPaymentQrCode(systemDefaultQr);
            setQrCodeSource(systemDefaultQr ? 'system' : 'none');
        } finally {
            setIsLoadingQr(false);
        }
    };
    
    // 当系统默认收款码加载完成后，处理收款码显示逻辑
    useEffect(() => {
        if (isOpen && marketer && systemDefaultQr !== undefined) {
            fetchMarketerInfo(marketer);
        } else if (isOpen && !marketer && systemDefaultQr !== undefined) {
            // 没有销售员信息时使用系统默认收款码
            setPaymentQrCode(systemDefaultQr);
            setQrCodeSource(systemDefaultQr ? 'system' : 'none');
        }
    }, [isOpen, marketer, systemDefaultQr]);

    // 当模态框关闭或选中的号码变化时，重置所有状态
    useEffect(() => {
        if (!isOpen) {
            // 使用短暂延迟以确保关闭动画流畅
            setTimeout(() => {
                setPaymentOption(20);
                setCustomerName('');
                setCustomerContact('');
                setShippingAddress('');
                setError(null);
                setIsLoading(false);
                setOrderSubmitted(false);
                setPaymentQrCode(null);
                setIsLoadingQr(false);
                setQrCodeSource('none'); // 重置收款码来源
            }, 300);
        }
    }, [isOpen]);

    const handleClose = () => {
        onClose();
    };

    if (!isOpen || !number) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const orderData: OrderData = {
                numberId: number.id,
                paymentAmount: paymentOption,
                customerName,
                customerContact,
                shippingAddress: paymentOption === 200 ? shippingAddress : undefined,
            };
            
            // 如果有销售人员参数，添加到订单数据中
            if (marketer) {
                orderData.assignedMarketer = marketer;
            }
            
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData),
            });

            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || '订单提交失败，该号码可能已被抢先预定。');
            }

            // 通知父组件在后台刷新数据
            onOrderSuccess();
            // 切换到二维码/成功视图
            setOrderSubmitted(true);

        } catch (err: unknown) {
            console.error('Error:', err);
            const errorMessage = err instanceof Error ? err.message : '订单提交失败';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // 获取二维码提示文本的函数
    const getQrCodeTipText = () => {
        switch (qrCodeSource) {
            case 'marketer':
                return '💡 这是您专属销售员的二维码';
            case 'system':
                return '💡 未配置个人图片，展示系统基础图片';
            case 'none':
                return '❌ 未配置基础图片，请联系管理员';
            default:
                return '';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity duration-300">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative animate-in fade-in-90 slide-in-from-bottom-10 duration-500">
                <button onClick={handleClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl z-10">&times;</button>

                {!orderSubmitted ? (
                    // 视图 1: 订单表单
                    <>
                        <h2 className="text-2xl font-bold mb-2">预定号码</h2>
                        <p className="text-xl font-mono bg-gray-100 p-2 rounded text-center mb-4">{number.phoneNumber}</p>
                        
                        {/* 学校和院系信息醒目显示 */}
                        {(organizationInfo?.schoolName || organizationInfo?.departmentName) && (
                            <div className="mb-4 p-4 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-lg">
                                <div className="text-center">
                                    <div className="flex items-center justify-center mb-2">
                                        <svg className="w-5 h-5 mr-2 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-red-700 font-bold text-sm">请确认您的机构信息</span>
                                    </div>
                                    {organizationInfo?.schoolName && (
                                        <div className="text-lg font-bold text-red-800 mb-1">
                                            🏫 {organizationInfo.schoolName}
                                        </div>
                                    )}
                                    {organizationInfo?.departmentName && (
                                        <div className="text-base font-semibold text-red-700 mb-2">
                                            🎓 {organizationInfo.departmentName}
                                        </div>
                                    )}
                                    <div className="text-xs text-red-600 font-medium">
                                        ⚠️ 此号码仅限上述机构成员选择，请确认信息无误
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* 显示销售人员信息（如果有） */}
                        {marketer && (
                            <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm text-blue-800">
                                        <strong>专属销售：</strong>{marketer}
                                    </span>
                                </div>
                            </div>
                        )}
                        
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">选择交单方式</label>
                                <div className="flex space-x-4">
                                    <div onClick={() => setPaymentOption(20)} className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition-all ${paymentOption === 20 ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300 hover:border-gray-400'}`}>
                                        <p className="font-semibold">20元 定金</p>
                                        <p className="text-xs text-gray-500">锁定号码，后续联系</p>
                                    </div>
                                    <div onClick={() => setPaymentOption(200)} className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition-all ${paymentOption === 200 ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300 hover:border-gray-400'}`}>
                                        <p className="font-semibold">200元 全款</p>
                                        <p className="text-xs text-gray-500">直接邮寄到家/送到寝室</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <input type="text" placeholder="客户姓名 (必填)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"/>
                                <input type="tel" placeholder="联系电话 (必填)" value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"/>
                                {paymentOption === 200 && (
                                    <textarea placeholder="收货地址 (必填)" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} required rows={3} className="w-full p-2 border border-gray-300 rounded-md transition-all focus:ring-2 focus:ring-blue-500"/>
                                )}
                            </div>

                            {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}

                            <div className="mt-6">
                                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors">
                                    {isLoading ? '提交中...' : '立即锁定'}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    // 视图 2: 二维码/成功视图
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-green-600 mb-2">预定成功！</h2>
                        <p className="text-lg font-mono bg-gray-100 p-2 rounded mb-4">{number.phoneNumber}</p>
                        <p className="text-sm text-gray-600 mb-4">
                            号码已为您临时锁定。请截图保存并联系工作人员完成支付并
                            <strong className="text-red-500">确认订单！</strong>
                            {marketer && (
                                <span className="block mt-2 text-blue-600 font-medium">
                                    您的专属销售：{marketer}
                                </span>
                            )}
                        </p>
                        <div className="flex justify-center my-4">
                            {isLoadingQr ? (
                                <div className="w-48 h-48 md:w-56 md:h-56 border rounded-lg flex items-center justify-center bg-gray-100">
                                    <div className="text-gray-500">加载二维码中...</div>
                                </div>
                            ) : (
                                <Image
                                    src={paymentQrCode || 'https://placehold.co/256x256/f87171/ffffff?text=未配置二维码'}
                                    alt="支付二维码"
                                    width={224}
                                    height={224}
                                    className="w-48 h-48 md:w-56 md:h-56 border rounded-lg"
                                    onError={(e) => { 
                                        e.currentTarget.src = 'https://placehold.co/256x256/f87171/ffffff?text=图片加载失败'; 
                                    }}
                                />
                            )}
                        </div>
                        {/* 根据二维码来源显示不同的提示信息 */}
                        <p className="text-xs text-gray-500 mb-4">
                            {getQrCodeTipText()}
                        </p>
                        <button
                            onClick={handleClose}
                            className="w-full bg-gray-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                            我已支付，关闭窗口
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
