"use client";

import {useState} from 'react';
import type {PhoneNumber} from '@prisma/client';

// 定义组件接收的props类型
interface NumberCardProps {
    number: PhoneNumber;
    onClick: (number: PhoneNumber) => void; // 用于处理点击事件的回调函数
}

// 复制图标 (SVG)
const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path
            d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
        <path
            d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
    </svg>
);

// 复制成功图标 (SVG)
const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="text-green-500"
         viewBox="0 0 16 16">
        <path
            d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
    </svg>
);


export const NumberCard = ({number, onClick}: NumberCardProps) => {
    const [isCopied, setIsCopied] = useState(false);

    // 判断号码是否可选
    const isAvailable = number.reservationStatus === 'UNRESERVED';

    // 处理复制事件
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation(); // 阻止事件冒泡，防止点击复制时触发卡片点击事件
        if (!number.phoneNumber) return;
        navigator.clipboard.writeText(number.phoneNumber);
        setIsCopied(true);
        setTimeout(() => {
            setIsCopied(false);
        }, 2000); // 2秒后恢复复制图标
    };

    // 根据号码状态动态生成样式
    const cardClasses = [
        "relative group flex items-center justify-center p-4 border rounded-lg shadow-sm transition-all duration-300",
        isAvailable ? "cursor-pointer hover:shadow-md hover:-translate-y-1" : "cursor-not-allowed",
        isAvailable && number.isPremium ? "border-2 border-red-500 bg-red-50" : "",
        !isAvailable ? "bg-gray-200 border-gray-300" : "bg-white",
    ].join(' ');

    const numberTextClasses = [
        "text-lg md:text-xl font-semibold tracking-wider",
        isAvailable ? (number.isPremium ? "text-red-600" : "text-gray-800") : "text-gray-500 line-through",
    ].join(' ');

    // 获取状态显示文本
    const getStatusText = () => {
        if (number.reservationStatus === 'PENDING_REVIEW') return '审核中';
        if (number.reservationStatus === 'RESERVED') return '已预定';
        return null;
    }

    const statusText = getStatusText();

    return (
        <div className={cardClasses} onClick={() => isAvailable && onClick(number)}>
            {/* 复制按钮 */}
            <button
                onClick={handleCopy}
                className="absolute top-2 left-2 p-1.5 rounded-full bg-gray-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-gray-500/20"
                title="复制号码"
            >
                {isCopied ? <CheckIcon/> : <CopyIcon/>}
            </button>

            {/* 靓号或状态标签 */}
            {(number.isPremium && isAvailable) && (
                <div
                    className="absolute top-0 right-0 px-2 py-1 text-xs font-bold text-white bg-red-500 rounded-bl-lg rounded-tr-lg">
                    {number.premiumReason || '靓号'}
                </div>
            )}
            {!isAvailable && statusText && (
                <div
                    className="absolute top-0 right-0 px-2 py-1 text-xs font-bold text-white bg-gray-500 rounded-bl-lg rounded-tr-lg">
                    {statusText}
                </div>
            )}

            {/* 号码文本 */}
            <span className={numberTextClasses}>
        {number.phoneNumber}
      </span>
        </div>
    );
};
