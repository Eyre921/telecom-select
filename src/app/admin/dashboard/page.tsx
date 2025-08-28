"use client";

import {useCallback, useEffect, useState} from 'react';
import {signOut, useSession} from 'next-auth/react';
import Link from 'next/link';
import {PhoneNumber, Organization} from '@prisma/client';
import {StatsCards} from '@/components/admin/StatsCards';
import {PendingOrdersTable} from '@/components/admin/PendingOrdersTable';
import {EditOrderModal} from '@/components/admin/EditOrderModal';
import {ExportModal} from '@/components/admin/ExportModal';
import {ENUM_TRANSLATIONS, FIELD_TRANSLATIONS} from '@/lib/utils';

// --- 类型定义 ---
// 扩展PhoneNumber类型，包含关联的学校信息
type PhoneNumberWithOrganizations = PhoneNumber & {
    school?: Organization | null;
    department?: Organization | null;
};

type SortConfig = { field: keyof PhoneNumber, direction: 'asc' | 'desc' };

// --- 默认配置 ---
const ALL_COLUMNS: (keyof PhoneNumber)[] = Object.keys(FIELD_TRANSLATIONS) as (keyof PhoneNumber)[];
const DEFAULT_VISIBLE_COLUMNS: (keyof PhoneNumber)[] = ['phoneNumber', 'reservationStatus', 'customerName', 'customerContact', 'emsTrackingNumber', 'assignedMarketer', 'deliveryStatus'];
const ITEMS_PER_PAGE = 50;

// --- 子组件 ---
const FullPageSpinner = () => (
    <div className="fixed inset-0 bg-white bg-opacity-75 z-50 flex justify-center items-center">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-500"></div>
    </div>
);

// 获取字段显示值的辅助函数
const getFieldDisplayValue = (number: PhoneNumberWithOrganizations, header: keyof PhoneNumber): string => {
    // 处理学校和院系字段
    if (header === 'schoolId' && number.school) {
        return number.school.name;
    }
    if (header === 'departmentId' && number.department) {
        return number.department.name;
    }
    
    const value = number[header];
    if (value === null || value === undefined) {
        return '-';
    }
    
    // 处理枚举字段的翻译
    if (header === 'reservationStatus' && ENUM_TRANSLATIONS.ReservationStatus) {
        return ENUM_TRANSLATIONS.ReservationStatus[value as string] || String(value);
    }
    if (header === 'paymentMethod' && ENUM_TRANSLATIONS.PaymentMethod) {
        return ENUM_TRANSLATIONS.PaymentMethod[value as string] || String(value);
    }
    if (header === 'deliveryStatus' && ENUM_TRANSLATIONS.DeliveryStatus) {
        return ENUM_TRANSLATIONS.DeliveryStatus[value as string] || String(value);
    }
    
    // 处理布尔值
    if (typeof value === 'boolean') {
        return value ? '是' : '否';
    }
    
    // 处理日期
    if (value instanceof Date) {
        return value.toLocaleString('zh-CN');
    }
    
    return String(value);
};

const MainDataTable = ({numbers, onEdit, onDelete, onRelease, onSort, sortConfig, visibleColumns, isAdmin}: {
    numbers: PhoneNumberWithOrganizations[],
    onEdit: (number: PhoneNumberWithOrganizations) => void,
    onDelete: (id: string) => void,
    onRelease: (id: string) => void,
    onSort: (field: keyof PhoneNumber) => void,
    sortConfig: SortConfig,
    visibleColumns: (keyof PhoneNumber)[],
    isAdmin: boolean
}) => {
    return (
        <div className="bg-white shadow overflow-x-auto rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                <tr>
                    {visibleColumns.map(header => (
                        <th key={header} onClick={() => onSort(header)}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                            {FIELD_TRANSLATIONS[header] || header}
                            {sortConfig.field === header && (
                                <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>)}
                        </th>
                    ))}
                    <th className="relative px-6 py-3 text-right">操作</th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {numbers.length === 0 ? (
                    <tr>
                        <td colSpan={visibleColumns.length + 1} className="px-6 py-20 text-center text-gray-500">
                            未找到任何数据。
                        </td>
                    </tr>
                ) : (
                    numbers.map((number) => (
                        <tr key={number.id}>
                            {visibleColumns.map(header => (
                                <td key={header} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {getFieldDisplayValue(number, header)}
                                </td>
                            ))}
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                <button onClick={() => onEdit(number)}
                                        className="text-indigo-600 hover:text-indigo-900">编辑
                                </button>
                                <button onClick={() => onRelease(number.id)}
                                        className="text-green-600 hover:text-green-900">释放
                                </button>
                                {isAdmin && <button onClick={() => onDelete(number.id)}
                                                    className="text-red-600 hover:text-red-900">删除</button>}
                            </td>
                        </tr>
                    ))
                )}
                </tbody>
            </table>
        </div>
    );
};

const Pagination = ({currentPage, totalPages, onPageChange}: {
    currentPage: number,
    totalPages: number,
    onPageChange: (page: number) => void
}) => {
    if (totalPages <= 1) return null;

    return (
        <div className="mt-4 flex items-center justify-center space-x-2 bg-white p-2 rounded-md shadow">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                上一页
            </button>
            <span className="text-sm text-gray-700">
                第 {currentPage} 页 / 共 {totalPages} 页
            </span>
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                下一页
            </button>
        </div>
    );
};


// --- 主页面组件 ---
// 在文件顶部添加导入
import { SchoolSelector } from '@/components/admin/SchoolSelector';

export default function DashboardPage() {
    const {data: session} = useSession();
    const isAdmin = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'SCHOOL_ADMIN';
    
    // 根据用户角色显示不同的按钮文案
    const clearButtonText = session?.user?.role === 'SCHOOL_ADMIN' 
        ? '【高危】一键清除本校所有号码信息' 
        : '【高危】一键清除所有号码信息';

    const [allNumbers, setAllNumbers] = useState<PhoneNumberWithOrganizations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [visibleColumns, setVisibleColumns] = useState<(keyof PhoneNumber)[]>(DEFAULT_VISIBLE_COLUMNS);
    const [sortConfig, setSortConfig] = useState<SortConfig>({field: 'createdAt', direction: 'desc'});
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedNumber, setSelectedNumber] = useState<PhoneNumberWithOrganizations | null>(null);
    const [deleteSearchTerm, setDeleteSearchTerm] = useState('');
    const [prefixTerm, setPrefixTerm] = useState('');
    const [pendingOrders, setPendingOrders] = useState<PhoneNumberWithOrganizations[]>([]);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    // 新增：筛选相关状态
    const [schools, setSchools] = useState<Organization[]>([]);
    const [departments, setDepartments] = useState<Organization[]>([]);
    const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');

    // 拖拽状态 - 移到组件内部
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // 获取学校列表
    const fetchSchools = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/organizations?type=SCHOOL');
            if (response.ok) {
                const data = await response.json();
                setSchools(data);
            }
        } catch (err) {
            console.error('获取学校列表失败:', err);
        }
    }, []);

    // 获取院系列表
    const fetchDepartments = useCallback(async (schoolId: string) => {
        try {
            const response = await fetch(`/api/admin/organizations?type=DEPARTMENT&parentId=${schoolId}`);
            if (response.ok) {
                const data = await response.json();
                setDepartments(data);
            }
        } catch (err) {
            console.error('获取院系列表失败:', err);
        }
    }, []);

    const fetchData = useCallback(async (pageToFetch: number, currentSearchTerm: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (currentSearchTerm) {
                params.append('search', currentSearchTerm);
            }
            if (selectedSchoolId) {
                params.append('schoolId', selectedSchoolId);
            }
            if (selectedDepartmentId) {
                params.append('departmentId', selectedDepartmentId);
            }
            params.append('sort', JSON.stringify(sortConfig));
            params.append('page', String(pageToFetch));
            params.append('limit', String(ITEMS_PER_PAGE));
    
            const response = await fetch(`/api/admin/numbers?${params.toString()}`);
            
            // 增强错误处理
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: '未知错误' }));
                const errorMessage = response.status === 401 
                    ? '认证失败，请重新登录' 
                    : response.status === 403 
                    ? '权限不足，无法访问数据' 
                    : errorData.error || `请求失败 (${response.status})`;
                throw new Error(errorMessage);
            }
    
            const result = await response.json();
            setAllNumbers(result.data);
            setCurrentPage(result.page);
            setTotalPages(Math.ceil(result.total / ITEMS_PER_PAGE));
    
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : '未知错误';
            console.error('获取号码数据失败:', err);
            setError(errorMessage);
            
            // 如果是认证错误，可以考虑重定向到登录页
            if (errorMessage.includes('认证失败')) {
                // 可以添加重定向逻辑
            }
        } finally {
            setIsLoading(false);
        }
    }, [sortConfig, selectedSchoolId, selectedDepartmentId]);
    
    const fetchPendingOrders = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/pending-orders');
            if (response.ok) {
                const data = await response.json();
                setPendingOrders(data);
            }
        } catch (err) {
            console.error('获取待审核订单失败:', err);
        }
    }, []);
    
    // 移除 searchTerm 从 useEffect 依赖中
    useEffect(() => {
        fetchData(1, '');
        fetchPendingOrders();
    }, [sortConfig, fetchData, fetchPendingOrders]); // 移除 searchTerm
    
    // 修改 handleSearch 函数，确保从第一页开始搜索
    const handleSearch = () => {
        setCurrentPage(1);
        fetchData(1, searchTerm);
    };
    
    // 添加清空搜索功能
    const handleClearSearch = () => {
        setSearchTerm('');
        setCurrentPage(1);
        fetchData(1, '');
    };

    // 当筛选条件变化时，重新获取数据
    useEffect(() => {
        fetchData(1, searchTerm);
    }, [selectedSchoolId, selectedDepartmentId]);

    const handlePageChange = (newPage: number) => {
        if (newPage > 0 && newPage <= totalPages && newPage !== currentPage) {
            fetchData(newPage, searchTerm);
        }
    };
    const refreshAllData = async () => {
        await fetchData(currentPage, searchTerm);
        await fetchPendingOrders();
    };


    const handleEdit = (number: PhoneNumberWithOrganizations) => {
        setSelectedNumber(number);
        setIsEditModalOpen(true);
    };
    const handleCloseModal = () => {
        setIsEditModalOpen(false);
        setSelectedNumber(null);
    };

    const handleSave = async (id: string, updatedData: Partial<PhoneNumber>) => {
        try {
            const response = await fetch(`/api/admin/numbers/${id}`, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(updatedData),
            });
            if (!response.ok) throw new Error((await response.json()).error || '保存失败');
            await refreshAllData();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : '保存失败';
            alert(`保存失败: ${errorMessage}`);
        }
    };

    const handleSort = (field: keyof PhoneNumber) => {
        setSortConfig(prev => ({field, direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'}));
    };

    // 在现有的 handleColumnToggle 函数后添加新的排序函数
    const handleColumnToggle = (field: keyof PhoneNumber) => {
        setVisibleColumns(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
    };
    
    // 新增：字段上移函数
    const handleMoveColumnUp = (field: keyof PhoneNumber) => {
        setVisibleColumns(prev => {
            const index = prev.indexOf(field);
            if (index > 0) {
                const newColumns = [...prev];
                [newColumns[index - 1], newColumns[index]] = [newColumns[index], newColumns[index - 1]];
                return newColumns;
            }
            return prev;
        });
    };
    
    // 新增：字段下移函数
    const handleMoveColumnDown = (field: keyof PhoneNumber) => {
        setVisibleColumns(prev => {
            const index = prev.indexOf(field);
            if (index >= 0 && index < prev.length - 1) {
                const newColumns = [...prev];
                [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
                return newColumns;
            }
            return prev;
        });
    };

    // 拖拽处理函数
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        
        if (draggedIndex === null || draggedIndex === dropIndex) {
            return;
        }
        
        setVisibleColumns(prev => {
            const newColumns = [...prev];
            const draggedItem = newColumns[draggedIndex];
            
            // 移除被拖拽的项
            newColumns.splice(draggedIndex, 1);
            
            // 在新位置插入
            newColumns.splice(dropIndex, 0, draggedItem);
            
            return newColumns;
        });
        
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleRelease = async (id: string) => {
        if (!confirm('您确定要释放这个号码吗？除号码本身外，所有客户和订单信息都将被清空。')) return;
        try {
            await handleSave(id, {
                reservationStatus: 'UNRESERVED',
                orderTimestamp: null, paymentAmount: null, paymentMethod: null,
                transactionId: null, customerName: null, customerContact: null,
                shippingAddress: null, emsTrackingNumber: null, deliveryStatus: null,
                assignedMarketer: null,
            });
            alert('号码已成功释放！');
        } catch {
            // handleSave 内部已经有 alert
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('【高危操作】您确定要永久删除这条记录吗？此操作不可恢复！')) return;
        try {
            const response = await fetch(`/api/admin/numbers/${id}`, {method: 'DELETE'});
            // 修改：接受200状态码
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '删除失败');
            }
            alert('记录已成功删除！');
            await refreshAllData();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : '删除失败';
            alert(`删除失败: ${errorMessage}`);
        }
    };

    const handleDeleteByNumber = async () => {
        if (!deleteSearchTerm) return alert('请输入要删除的号码');
        if (!confirm(`【高危操作】您确定要永久删除号码 ${deleteSearchTerm} 吗？`)) return;
        setIsLoading(true);
        try {
            const numberToDelete = allNumbers.find(n => n.phoneNumber === deleteSearchTerm);
            if (numberToDelete) {
                await handleDelete(numberToDelete.id);
                setDeleteSearchTerm('');
            } else {
                alert('未在当前列表中找到该号码。请注意，该操作只能删除当前已加载列表中的号码。');
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : '操作失败';
            alert(`操作失败: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdminAction = async (action: string, payload?: Record<string, unknown>) => {
        const confirmationMessages: { [key: string]: string } = {
            CLEAR_ALL_NUMBERS: '【高危操作】您确定要清除所有号码信息吗？此操作不可恢复！',
            BAN_PREFIX: `您确定要禁售所有以 ${payload?.prefix} 开头的号码吗？（已预定的号码不受影响）`,
            UNBAN_PREFIX: `您确定要解禁所有以 ${payload?.prefix} 开头的号码吗？`,
        };
        if (!confirm(confirmationMessages[action])) return;

        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/actions', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({action, payload}),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            alert(result.message);
            await refreshAllData();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : '操作失败';
            alert(`操作失败: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    // SchoolSelector的重置函数
    const handleResetFilters = () => {
        setSelectedSchoolId('');
        setSelectedDepartmentId('');
        setCurrentPage(1);
    };

    if (isLoading && totalPages === 0) return <FullPageSpinner/>;
    if (error) return <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg m-8">{error}</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {/* 用户信息和导航区域 */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-semibold text-lg">
                                    {session?.user?.name?.charAt(0) || 'U'}
                                </span>
                            </div>
                            <div>
                                <h1 className="text-lg font-semibold text-gray-900">
                                    欢迎，{session?.user?.name || '用户'}
                                </h1>
                                <div className="flex items-center space-x-2">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        session?.user?.role === 'SUPER_ADMIN' ? 'bg-red-100 text-red-800' :
                                        session?.user?.role === 'SCHOOL_ADMIN' ? 'bg-blue-100 text-blue-800' :
                                        'bg-green-100 text-green-800'
                                    }`}>
                                        {ENUM_TRANSLATIONS.Role[session?.user?.role as string] || session?.user?.role}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        {session?.user?.email}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        {/* 管理用户按钮 - 仅对有权限的用户显示 */}
                        {isAdmin && (
                            <Link
                                href="/admin/users"
                                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                </svg>
                                管理用户
                            </Link>
                        )}
                        
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
                        >
                            导出数据
                        </button>
                        {/* 批量导入按钮 - 仅对超级管理员和学校管理员可见 */}
                        {isAdmin && (
                            <Link href="/admin/import"
                                  className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors">
                                批量导入数据
                            </Link>
                        )}
                        <button
                            onClick={async () => {
                                await signOut({ redirect: false });
                                window.location.href = '/signin';
                            }}
                            className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition-colors"
                        >
                            登出
                        </button>
                    </div>
                </div>
            </div>

            {/* 移除原有的功能按钮区域，因为已经整合到上面的用户信息区域 */}
            {/* --- 新增的功能按钮区域 --- */}
            {/* <div className="flex justify-end items-center gap-4 mb-6"> ... </div> */}

            {isLoading && <FullPageSpinner/>}
            <StatsCards/>
            <PendingOrdersTable initialPendingNumbers={pendingOrders} onApprove={handleEdit}
                                onRelease={handleRelease}/>

            <div className="mt-8 space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">号码数据中心</h2>
                <div className="p-4 bg-white rounded-lg shadow space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                placeholder="按号码、姓名、联系方式或营销人员搜索..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="flex-1 p-2 border rounded-md"
                            />
                            <button onClick={handleSearch}
                                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-400"
                                    disabled={isLoading}>
                                {isLoading ? '搜索中...' : '搜索'}
                            </button>
                            <button onClick={handleClearSearch}
                                    className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-md hover:bg-gray-600"
                                    disabled={isLoading}>
                                清空
                            </button>
                        </div>
                    </div>
                    {/* 使用新的SchoolSelector组件替换原有的筛选区域 */}
                    <SchoolSelector
                        selectedSchoolId={selectedSchoolId}
                        selectedDepartmentId={selectedDepartmentId}
                        onSchoolChange={setSelectedSchoolId}
                        onDepartmentChange={setSelectedDepartmentId}
                        showDepartments={true}
                        showResetButton={true}
                        onReset={handleResetFilters}
                        disabled={isLoading}
                    />
                    
                    {/* 字段选择区域 - 优化布局 */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2z" />
                            </svg>
                            自定义显示列
                        </h4>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* 左侧：已选择字段 */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h5 className="text-xs font-medium text-gray-600">已选择 ({visibleColumns.length})</h5>
                                    <span className="text-xs text-gray-400">可拖拽排序</span>
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded p-2 bg-white">
                                    {visibleColumns.map((col, index) => (
                                        <div 
                                            key={col} 
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, index)}
                                            className={`group flex items-center justify-between p-2 text-sm border rounded cursor-move transition-all duration-150 ${
                                                draggedIndex === index 
                                                    ? 'bg-blue-100 border-blue-300 opacity-60 scale-[0.98]' 
                                                    : dragOverIndex === index 
                                                        ? 'bg-green-50 border-green-300 border-dashed' 
                                                        : 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                                            }`}
                                        >
                                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                {/* 拖拽手柄 */}
                                                <div className="flex flex-col space-y-0.5 text-gray-400 group-hover:text-blue-500 transition-colors">
                                                    <div className="w-1 h-1 bg-current rounded-full"></div>
                                                    <div className="w-1 h-1 bg-current rounded-full"></div>
                                                    <div className="w-1 h-1 bg-current rounded-full"></div>
                                                </div>
                                                
                                                {/* 字段名称 */}
                                                <span className="font-medium text-gray-700 truncate">
                                                    {FIELD_TRANSLATIONS[col]}
                                                </span>
                                                
                                                {/* 序号标签 */}
                                                <span className="text-xs bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                                    {index + 1}
                                                </span>
                                            </div>
                                            
                                            {/* 操作按钮 */}
                                            <div className="flex items-center space-x-1 ml-2">
                                                <button
                                                    onClick={() => handleMoveColumnUp(col)}
                                                    disabled={index === 0}
                                                    className="p-1 text-gray-400 hover:text-blue-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                                                    title="上移"
                                                >
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleMoveColumnDown(col)}
                                                    disabled={index === visibleColumns.length - 1}
                                                    className="p-1 text-gray-400 hover:text-blue-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                                                    title="下移"
                                                >
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleColumnToggle(col)}
                                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                    title="移除"
                                                >
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {visibleColumns.length === 0 && (
                                        <div className="text-center py-4 text-gray-400 text-sm">
                                            请从右侧添加字段
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* 右侧：可添加字段 */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h5 className="text-xs font-medium text-gray-600">可添加字段</h5>
                                    <span className="text-xs text-gray-400">({ALL_COLUMNS.filter(col => !visibleColumns.includes(col)).length} 个)</span>
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded p-2 bg-white">
                                    {ALL_COLUMNS.filter(col => !visibleColumns.includes(col)).map(col => (
                                        <button
                                            key={col}
                                            onClick={() => handleColumnToggle(col)}
                                            className="w-full flex items-center justify-between p-2 text-sm bg-gray-50 border border-gray-200 rounded hover:bg-green-50 hover:border-green-300 transition-all duration-150 group"
                                        >
                                            <span className="text-gray-700 group-hover:text-green-700 font-medium">
                                                {FIELD_TRANSLATIONS[col]}
                                            </span>
                                            <svg className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    ))}
                                    {ALL_COLUMNS.filter(col => !visibleColumns.includes(col)).length === 0 && (
                                        <div className="text-center py-4 text-gray-400 text-sm">
                                            所有字段已添加
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* 快捷操作 */}
                        <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                            <div className="text-xs text-gray-500">
                                提示：拖拽左侧字段可调整显示顺序
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setVisibleColumns(ALL_COLUMNS)}
                                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                >
                                    全选
                                </button>
                                <button
                                    onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}
                                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                                >
                                    重置
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <MainDataTable numbers={allNumbers} onEdit={handleEdit} onDelete={handleDelete}
                               onRelease={handleRelease} onSort={handleSort} sortConfig={sortConfig}
                               visibleColumns={visibleColumns} isAdmin={isAdmin || false}/>
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange}/>
            </div>

            {/* 管理员危险操作区域 */}
            {isAdmin && (
                <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="text-lg font-semibold text-red-800 mb-4">管理员危险操作区域</h3>
                    <div className="space-y-4">
                        <div className="flex items-center space-x-4">
                            <input
                                type="text"
                                placeholder="输入要删除的号码"
                                value={deleteSearchTerm}
                                onChange={e => setDeleteSearchTerm(e.target.value)}
                                className="flex-1 p-2 border rounded-md"
                            />
                            <button onClick={handleDeleteByNumber}
                                    className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700">
                                按号码精确删除
                            </button>
                        </div>
                        <div className="flex items-center space-x-4">
                            <input
                                type="text"
                                placeholder="输入号段前缀（如：1380）"
                                value={prefixTerm}
                                onChange={e => setPrefixTerm(e.target.value)}
                                className="flex-1 p-2 border rounded-md"
                            />
                            <button onClick={() => handleAdminAction('BAN_PREFIX', {prefix: prefixTerm})}
                                    className="px-4 py-2 bg-orange-600 text-white font-semibold rounded-md hover:bg-orange-700">
                                按号段禁售
                            </button>
                            <button onClick={() => handleAdminAction('UNBAN_PREFIX', {prefix: prefixTerm})}
                                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700">
                                按号段解禁
                            </button>
                        </div>
                        <button onClick={() => handleAdminAction('CLEAR_ALL_NUMBERS')}
                                className="w-full px-4 py-2 bg-red-700 text-white font-semibold rounded-md hover:bg-red-800">
                            {clearButtonText}
                        </button>
                    </div>
                </div>
            )}

            <EditOrderModal isOpen={isEditModalOpen} onClose={handleCloseModal} numberData={selectedNumber}
                            onSave={(id, data) => handleSave(id, data)}/>
            
            <ExportModal 
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                data={allNumbers}
                allColumns={ALL_COLUMNS}
            />
        </div>
    );
}
