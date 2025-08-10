"use client";

import { useState, useEffect, useMemo } from 'react';
import { PhoneNumber } from '@prisma/client';
import { NumberCard } from '@/components/ui/NumberCard';
import { OrderModal } from '@/components/ui/OrderModal';

// 一个简单的加载动画组件
const Spinner = () => (
    <div className="flex justify-center items-center py-20">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-500"></div>
    </div>
);

export default function HomePage() {
  const [allNumbers, setAllNumbers] = useState<PhoneNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [hideReserved, setHideReserved] = useState(false);

  const [selectedNumber, setSelectedNumber] = useState<PhoneNumber | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // 定义获取数据的函数
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/numbers');
      if (!response.ok) {
        throw new Error('获取号码列表失败，请稍后重试');
      }
      const data = await response.json();
      setAllNumbers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    fetchData();
  }, []);

  // 使用 useMemo 优化筛选逻辑，避免不必要的重复计算
  const filteredNumbers = useMemo(() => {
    return allNumbers.filter(number => {
      const matchesSearch = number.phoneNumber.includes(searchTerm.trim());
      const matchesVisibility = !hideReserved || number.reservationStatus === 'UNRESERVED';
      return matchesSearch && matchesVisibility;
    });
  }, [allNumbers, searchTerm, hideReserved]);

  // 定义各种事件处理函数
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
    // 订单成功后，重新获取最新数据以更新号码状态
    fetchData();
    setTimeout(() => {
      setShowSuccessMessage(false);
    }, 5000); // 成功消息显示5秒
  };

  return (
      <main className="container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
        {/* 订单成功消息横幅 */}
        {showSuccessMessage && (
            <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-md shadow-lg animate-in fade-in-50" role="alert">
              <p className="font-bold">预定成功!</p>
              <p>您的号码已临时锁定。请根据页面提示完成支付并联系销售人员确认。</p>
            </div>
        )}

        {/* 页面标题 */}
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">校园卡在线选号</h1>
          <p className="mt-2 text-gray-600">请选择您心仪的号码</p>
        </header>

        {/* 控制区域 */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-8 sticky top-4 z-40">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <input
                type="text"
                placeholder="搜索包含的数字..."
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
                  <input type="checkbox" className="sr-only" checked={hideReserved} onChange={() => setHideReserved(!hideReserved)} />
                  <div className={`block w-14 h-8 rounded-full transition-colors ${hideReserved ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${hideReserved ? 'transform translate-x-full' : ''}`}></div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* 内容展示区域 */}
        {isLoading ? (
            <Spinner />
        ) : error ? (
            <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</div>
        ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredNumbers.length > 0 ? (
                  filteredNumbers.map(number => (
                      <NumberCard key={number.id} number={number} onClick={handleCardClick} />
                  ))
              ) : (
                  <p className="col-span-full text-center text-gray-500 py-10">没有找到匹配的号码。</p>
              )}
            </div>
        )}

        {/* 订单模态框 */}
        <OrderModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            number={selectedNumber}
            onOrderSuccess={handleOrderSuccess}
        />
      </main>
  );
}
