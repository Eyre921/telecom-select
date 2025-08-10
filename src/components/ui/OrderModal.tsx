"use client";

import { useState, useEffect } from 'react';
import { PhoneNumber } from '@prisma/client';

interface OrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    number: PhoneNumber | null;
    onOrderSuccess: () => void;
}

export const OrderModal = ({ isOpen, onClose, number, onOrderSuccess }: OrderModalProps) => {
    // --- 请在这里修改您的二维码 ---
    // **第1步**: 将您的支付二维码图片链接粘贴到下面的引号中。
    // 例如: "https://www.your-website.com/qr-code.jpg"
    const YOUR_QR_CODE_IMAGE_URL = "https://www.baidu.com/img/flexible/logo/pc/result@2.png";
    // ---------------------------------

    // 表单状态
    const [paymentOption, setPaymentOption] = useState<20 | 200>(20);
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [shippingAddress, setShippingAddress] = useState('');

    // UI 状态
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [orderSubmitted, setOrderSubmitted] = useState(false); // 用于切换到二维码视图的新状态

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
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    numberId: number.id,
                    paymentAmount: paymentOption,
                    customerName,
                    customerContact,
                    shippingAddress: paymentOption === 200 ? shippingAddress : undefined,
                }),
            });

            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || '订单提交失败，该号码可能已被抢先预定。');
            }

            // 通知父组件在后台刷新数据
            onOrderSuccess();
            // 切换到二维码/成功视图
            setOrderSubmitted(true);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
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
                                        <p className="text-xs text-gray-500">直接邮寄到家</p>
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
                            号码已为您临时锁定。请截图保存并使用微信或支付宝扫描下方二维码完成支付。
                            <strong className="text-red-500">支付后请务必联系销售人员确认订单！</strong>
                        </p>
                        <div className="flex justify-center my-4">
                            <img
                                src={YOUR_QR_CODE_IMAGE_URL} // **第2步**: 这里会自动使用您在上面填写的链接
                                alt="支付二维码"
                                className="w-48 h-48 md:w-56 md:h-56 border rounded-lg"
                                onError={(e) => { e.currentTarget.src = 'https://placehold.co/256x256/f87171/ffffff?text=图片加载失败'; }}
                            />
                        </div>
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
