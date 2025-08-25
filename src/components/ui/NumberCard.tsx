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
        e.stopPropagation();
        if (!number.phoneNumber) return;
        navigator.clipboard.writeText(number.phoneNumber);
        setIsCopied(true);
        setTimeout(() => {
            setIsCopied(false);
        }, 2000);
    };

    // 根据号码状态动态生成样式 - 使用中国电信配色
    const cardClasses = [
        "relative group flex items-center justify-center p-4 border-2 rounded-xl shadow-sm transition-all duration-300 bg-white",
        isAvailable ? "cursor-pointer hover:shadow-lg hover:-translate-y-1 border-blue-200 hover:border-blue-400" : "cursor-not-allowed border-gray-200",
        isAvailable && number.isPremium ? "border-orange-400 bg-gradient-to-br from-orange-50 to-red-50" : "",
        !isAvailable ? "bg-gray-50 opacity-75" : "",
    ].join(' ');

    const numberTextClasses = [
        "text-lg md:text-xl font-bold tracking-wider",
        isAvailable ? (number.isPremium ? "text-orange-600" : "text-blue-700") : "text-gray-400 line-through",
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
            {/* 复制按钮 - 使用中国电信蓝色 */}
            <button
                onClick={handleCopy}
                className="absolute top-2 left-2 p-1.5 rounded-full bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-500/20 hover:scale-110"
                title="复制号码"
            >
                {isCopied ? <CheckIcon/> : <CopyIcon/>}
            </button>

            {/* 靓号标签 - 使用橙色渐变 */}
            {(number.isPremium && isAvailable) && (
                <div className="absolute top-0 right-0 px-3 py-1 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 rounded-bl-lg rounded-tr-xl shadow-md">
                    <div className="flex items-center space-x-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span>{number.premiumReason || '靓号'}</span>
                    </div>
                </div>
            )}
            
            {/* 状态标签 */}
            {!isAvailable && statusText && (
                <div className="absolute top-0 right-0 px-3 py-1 text-xs font-bold text-white bg-gray-500 rounded-bl-lg rounded-tr-xl">
                    {statusText}
                </div>
            )}

            {/* 号码文本 */}
            <span className={numberTextClasses}>
                {number.phoneNumber}
            </span>
            
            {/* 可选状态指示器 */}
            {isAvailable && (
                <div className="absolute bottom-2 right-2 w-3 h-3 bg-green-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            )}
        </div>
    );
};
