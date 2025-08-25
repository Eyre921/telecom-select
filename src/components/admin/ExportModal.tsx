"use client";

import { useState, useEffect } from 'react';
import { PhoneNumber } from '@prisma/client';
import { FIELD_TRANSLATIONS, ENUM_TRANSLATIONS } from '@/lib/utils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PhoneNumber[];
  allColumns: (keyof PhoneNumber)[];
}

type ExportFormat = 'csv' | 'excel';

export const ExportModal = ({ isOpen, onClose, allColumns }: ExportModalProps) => {
  // 状态管理
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');
  const [selectedColumns, setSelectedColumns] = useState<(keyof PhoneNumber)[]>([
    'phoneNumber', 'customerName', 'assignedMarketer', 'reservationStatus', 'paymentAmount'
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const [allData, setAllData] = useState<PhoneNumber[]>([]);
  const [isLoadingAllData, setIsLoadingAllData] = useState(false);
  
  // 筛选条件
  const [phonePrefix, setPhonePrefix] = useState('');
  const [assignedMarketer, setAssignedMarketer] = useState('');
  const [reservationStatus, setReservationStatus] = useState('');
  
  const [filteredData, setFilteredData] = useState<PhoneNumber[]>([]);

  // 获取所有数据
  const fetchAllData = async () => {
    setIsLoadingAllData(true);
    try {
      const response = await fetch('/api/admin/numbers?all=true');
      if (response.ok) {
        const result = await response.json();
        setAllData(result.data || result);
      }
    } catch (error) {
      console.error('获取全部数据失败:', error);
      alert('获取全部数据失败');
    } finally {
      setIsLoadingAllData(false);
    }
  };

  // 获取唯一的营销人员列表
  const getUniqueMarketers = () => {
    const marketers = allData
      .map(item => item.assignedMarketer)
      .filter((marketer, index, arr) => marketer && arr.indexOf(marketer) === index)
      .sort();
    return marketers;
  };

  // 应用筛选条件
  useEffect(() => {
    if (allData.length === 0) return;
    
    const filtered = allData.filter(item => {
      if (phonePrefix && !item.phoneNumber.startsWith(phonePrefix)) {
        return false;
      }
      if (assignedMarketer && item.assignedMarketer !== assignedMarketer) {
        return false;
      }
      if (reservationStatus && item.reservationStatus !== reservationStatus) {
        return false;
      }
      return true;
    });
    
    setFilteredData(filtered);
  }, [allData, phonePrefix, assignedMarketer, reservationStatus]);

  // 初始化时加载全部数据
  useEffect(() => {
    if (isOpen) {
      fetchAllData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 格式化数据
  const formatCellValue = (value: unknown, field: keyof PhoneNumber): string => {
    if (value === null || value === undefined) return '';
    
    if (field === 'reservationStatus' || field === 'paymentMethod' || field === 'deliveryStatus') {
      const enumKey = field.charAt(0).toUpperCase() + field.slice(1) as keyof typeof ENUM_TRANSLATIONS;
      return ENUM_TRANSLATIONS[enumKey]?.[value as string] || String(value);
    }
    
    if (field === 'createdAt' || field === 'updatedAt' || field === 'orderTimestamp') {
      // 添加类型检查，确保 value 是有效的日期类型
      if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
        return new Date(value).toLocaleString('zh-CN');
      }
      return String(value);
    }
    
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    
    return String(value);
  };

  // 为Excel格式化数据（防止长数字被转换为科学计数法）
  const formatCellValueForExcel = (value: unknown, field: keyof PhoneNumber): string => {
    const formattedValue = formatCellValue(value, field);
    
    // 对于可能是长数字字符串的字段，在前面添加制表符强制为文本格式
    if (field === 'emsTrackingNumber' || field === 'phoneNumber' || field === 'transactionId') {
      // 检查是否为纯数字字符串且长度较长
      if (/^\d+$/.test(formattedValue) && formattedValue.length > 10) {
        return `\t${formattedValue}`; // 使用制表符前缀强制为文本
      }
    }
    
    return formattedValue;
  };

  const exportToExcel = () => {
    const headers = selectedColumns.map(col => FIELD_TRANSLATIONS[col] || col);
    
    // 添加基本样式
    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .number { text-align: right; }
            .date { text-align: center; }
            .text { mso-number-format:"\@"; } /* Excel文本格式 */
          </style>
        </head>
        <body>
          <table>
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${filteredData.map(row => 
                `<tr>${selectedColumns.map(col => {
                  const value = formatCellValueForExcel(row[col], col);
                  let className = '';
                  if (col === 'paymentAmount') className = 'number';
                  if (col === 'createdAt' || col === 'updatedAt' || col === 'orderTimestamp') className = 'date';
                  if (col === 'emsTrackingNumber' || col === 'phoneNumber' || col === 'transactionId') className = 'text';
                  return `<td class="${className}">${value}</td>`;
                }).join('')}</tr>`
              ).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `号码数据_${new Date().toISOString().split('T')[0]}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async () => {
    if (selectedColumns.length === 0) {
      alert('请至少选择一个字段');
      return;
    }
    
    if (filteredData.length === 0) {
      alert('没有符合条件的数据可导出');
      return;
    }
    
    setIsExporting(true);
    
    try {
      if (exportFormat === 'csv') {
        // 生成CSV内容
        const headers = selectedColumns.map(col => FIELD_TRANSLATIONS[col] || col).join(',');
        const rows = filteredData.map(row => 
          selectedColumns.map(col => {
            const value = formatCellValue(row[col], col);
            // 如果值包含逗号、换行或引号，需要用引号包裹并转义引号
            return value.includes(',') || value.includes('\n') || value.includes('"') 
              ? `"${value.replace(/"/g, '""')}"` 
              : value;
          }).join(',')
        ).join('\n');
        const csvContent = `${headers}\n${rows}`;
        
        // 创建Blob并下载
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `号码数据_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        exportToExcel();
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b bg-blue-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">导出数据</h2>
            <p className="text-sm text-gray-600 mt-1">
              {isLoadingAllData ? '正在加载数据...' : `共 ${allData.length} 条数据`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>
        
        {/* 内容 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-4">
          
          {/* 筛选条件 */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">1</span>
              筛选条件（可选）
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">号段筛选</label>
                <input
                  type="text"
                  value={phonePrefix}
                  onChange={(e) => setPhonePrefix(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="如：138、139"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">营销人员</label>
                <select
                  value={assignedMarketer}
                  onChange={(e) => setAssignedMarketer(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">全部</option>
                  {getUniqueMarketers().map(marketer => (
                    <option key={marketer || ''} value={marketer || ''}>{marketer || ''}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">预定状态</label>
                <select
                  value={reservationStatus}
                  onChange={(e) => setReservationStatus(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">全部</option>
                  <option value="未预定">未预定</option>
                  <option value="审核中">审核中</option>
                  <option value="已预定">已预定</option>
                </select>
              </div>
            </div>
            
            {/* 筛选结果提示 */}
            <div className="mt-2 p-2 bg-blue-100 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                📊 筛选结果：<strong>{filteredData.length}</strong> 条数据
                {phonePrefix && ` | 号段：${phonePrefix}`}
                {assignedMarketer && ` | 营销人员：${assignedMarketer}`}
                {reservationStatus && ` | 状态：${reservationStatus}`}
              </p>
            </div>
          </div>

          {/* 选择导出字段 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">2</span>
              选择导出字段
            </h3>
            
            {/* 快捷操作 */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setSelectedColumns(allColumns)}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                全选
              </button>
              <button
                onClick={() => setSelectedColumns([])}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                清空
              </button>
              <button
                onClick={() => setSelectedColumns(['phoneNumber', 'customerName', 'assignedMarketer', 'reservationStatus', 'paymentAmount'])}
                className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              >
                常用字段
              </button>
            </div>
            
            {/* 字段选择 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {allColumns.map(col => (
                <label key={col} className="flex items-center p-2 bg-white border rounded cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedColumns(prev => [...prev, col]);
                      } else {
                        setSelectedColumns(prev => prev.filter(c => c !== col));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">{FIELD_TRANSLATIONS[col] || col}</span>
                </label>
              ))}
            </div>
            
            <p className="text-sm text-gray-500 mt-2">
              已选择 <strong>{selectedColumns.length}</strong> 个字段
            </p>
          </div>

          {/* 选择导出格式 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">3</span>
              选择导出格式
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-white transition-colors">
                <input
                  type="radio"
                  value="excel"
                  checked={exportFormat === 'excel'}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">Excel 格式 (.xls)</div>
                  <div className="text-sm text-gray-500">推荐，支持格式化显示</div>
                </div>
              </label>
              
              <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-white transition-colors">
                <input
                  type="radio"
                  value="csv"
                  checked={exportFormat === 'csv'}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">CSV 格式 (.csv)</div>
                  <div className="text-sm text-gray-500">通用格式，兼容性好</div>
                </div>
              </label>
            </div>
          </div>
        </div>
        
        {/* 底部按钮 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-t bg-gray-50 gap-3">
          <div className="text-sm text-gray-600">
            准备导出 <strong className="text-blue-600">{filteredData.length}</strong> 条数据，
            <strong className="text-blue-600">{selectedColumns.length}</strong> 个字段
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || selectedColumns.length === 0 || filteredData.length === 0 || isLoadingAllData}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  导出中...
                </>
              ) : (
                `🚀 开始导出`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};