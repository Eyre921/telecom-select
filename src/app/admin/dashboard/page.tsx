"use client";

import {useCallback, useEffect, useMemo, useState} from 'react';
import {signOut, useSession} from 'next-auth/react';
import Link from 'next/link';
import {PhoneNumber, ReservationStatus} from '@prisma/client';
import {StatsCards} from '@/components/admin/StatsCards';
import {PendingOrdersTable} from '@/components/admin/PendingOrdersTable';
import {EditOrderModal} from '@/components/admin/EditOrderModal';
import {ENUM_TRANSLATIONS, FIELD_TRANSLATIONS} from '@/lib/utils';

// --- 类型定义 ---
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

const MainDataTable = ({numbers, onEdit, onDelete, onRelease, onSort, sortConfig, visibleColumns, isAdmin}: {
    numbers: PhoneNumber[],
    onEdit: (number: PhoneNumber) => void,
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
                                <td key={header} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {(header === 'reservationStatus' || header === 'paymentMethod' || header === 'deliveryStatus')
                                        ? ENUM_TRANSLATIONS[header.charAt(0).toUpperCase() + header.slice(1) as keyof typeof ENUM_TRANSLATIONS]?.[number[header] as string] || number[header]
                                        : String(number[header] || '-')}
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
export default function DashboardPage() {
    const {data: session} = useSession();
    const isAdmin = session?.user?.role === 'ADMIN';

    const [allNumbers, setAllNumbers] = useState<PhoneNumber[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    const [visibleColumns, setVisibleColumns] = useState<(keyof PhoneNumber)[]>(DEFAULT_VISIBLE_COLUMNS);
    const [sortConfig, setSortConfig] = useState<SortConfig>({field: 'createdAt', direction: 'desc'});
    const [searchTerm, setSearchTerm] = useState('');

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedNumber, setSelectedNumber] = useState<PhoneNumber | null>(null);

    const [deleteSearchTerm, setDeleteSearchTerm] = useState('');
    const [prefixTerm, setPrefixTerm] = useState('');
    const [pendingOrders, setPendingOrders] = useState<PhoneNumber[]>([]);

    const fetchData = useCallback(async (pageToFetch: number, currentSearchTerm: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (currentSearchTerm) {
                params.append('search', currentSearchTerm);
            }
            params.append('sort', JSON.stringify(sortConfig));
            params.append('page', String(pageToFetch));
            params.append('limit', String(ITEMS_PER_PAGE));

            const response = await fetch(`/api/admin/numbers?${params.toString()}`);
            if (!response.ok) throw new Error('获取号码数据失败');

            const result = await response.json();

            setAllNumbers(result.data);
            setCurrentPage(result.page);
            setTotalPages(Math.ceil(result.total / ITEMS_PER_PAGE));

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [sortConfig]);
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
    useEffect(() => {
        fetchData(1, searchTerm);
        fetchPendingOrders();
    }, [sortConfig, fetchData, fetchPendingOrders]);
    const handleSearch = () => {
        setCurrentPage(1);
        fetchData(1, searchTerm);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage > 0 && newPage <= totalPages && newPage !== currentPage) {
            fetchData(newPage, searchTerm);
        }
    };
    const refreshAllData = async () => {
        await fetchData(currentPage, searchTerm);
        await fetchPendingOrders();
    };


    const handleEdit = (number: PhoneNumber) => {
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
        } catch (error: any) {
            alert(`保存失败: ${error.message}`);
        }
    };

    const handleSort = (field: keyof PhoneNumber) => {
        setSortConfig(prev => ({field, direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'}));
    };

    const handleColumnToggle = (field: keyof PhoneNumber) => {
        setVisibleColumns(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
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
        } catch (error) {
            // handleSave 内部已经有 alert
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('【高危操作】您确定要永久删除这条记录吗？此操作不可恢复！')) return;
        try {
            const response = await fetch(`/api/admin/numbers/${id}`, {method: 'DELETE'});
            if (response.status !== 204) throw new Error((await response.json()).error || '删除失败');
            alert('记录已成功删除！');
            await refreshAllData();
        } catch (error: any) {
            alert(`删除失败: ${error.message}`);
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
        } catch (error: any) {
            alert(`操作失败: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdminAction = async (action: string, payload?: any) => {
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
        } catch (error: any) {
            alert(`操作失败: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && totalPages === 0) return <FullPageSpinner/>;
    if (error) return <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg m-8">{error}</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {/* --- 新增的功能按钮区域 --- */}
            <div className="flex justify-end items-center gap-4 mb-6">
                <Link href="/admin/import"
                      className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors">
                    批量导入数据
                </Link>
                <button
                    onClick={() => signOut({callbackUrl: '/'})}
                    className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition-colors"
                >
                    登出
                </button>
            </div>

            {isLoading && <FullPageSpinner/>}
            <StatsCards/>
            <PendingOrdersTable initialPendingNumbers={pendingOrders} onApprove={handleEdit}
                                onRelease={handleRelease}/>

            <div className="mt-8 space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">号码数据中心</h2>
                <div className="p-4 bg-white rounded-lg shadow space-y-4">
                    <div className="flex items-center gap-4">
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
                    </div>
                    <div>
                        <h4 className="text-sm font-medium">选择显示列:</h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-2">
                            {ALL_COLUMNS.map(col => (
                                <label key={col} className="flex items-center space-x-2">
                                    <input type="checkbox" checked={visibleColumns.includes(col)}
                                           onChange={() => handleColumnToggle(col)}/>
                                    <span className="text-sm">{FIELD_TRANSLATIONS[col]}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <MainDataTable numbers={allNumbers} onEdit={handleEdit} onDelete={handleDelete}
                               onRelease={handleRelease} onSort={handleSort} sortConfig={sortConfig}
                               visibleColumns={visibleColumns} isAdmin={isAdmin || false}/>
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange}/>
            </div>

            {isAdmin && (
                <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="text-lg font-bold text-red-800">管理员危险操作</h3>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">按号码精确删除</label>
                            <div className="mt-1 flex rounded-md shadow-sm">
                                <input type="text" value={deleteSearchTerm}
                                       onChange={e => setDeleteSearchTerm(e.target.value)} placeholder="输入完整手机号"
                                       className="flex-1 p-2 border-gray-300 rounded-l-md"/>
                                <button onClick={handleDeleteByNumber}
                                        className="px-4 py-2 bg-red-600 text-white font-semibold rounded-r-md hover:bg-red-700">删除
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">按号段禁售/解禁</label>
                            <div className="mt-1 flex rounded-md shadow-sm">
                                <input type="text" value={prefixTerm} onChange={e => setPrefixTerm(e.target.value)}
                                       placeholder="输入号段前缀, 如 190"
                                       className="flex-1 p-2 border-gray-300 rounded-l-md"/>
                                <button onClick={() => handleAdminAction('BAN_PREFIX', {prefix: prefixTerm})}
                                        className="px-4 py-2 bg-yellow-500 text-white font-semibold hover:bg-yellow-600">禁售
                                </button>
                                <button onClick={() => handleAdminAction('UNBAN_PREFIX', {prefix: prefixTerm})}
                                        className="px-4 py-2 bg-green-500 text-white font-semibold rounded-r-md hover:bg-green-600">解禁
                                </button>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <button onClick={() => handleAdminAction('CLEAR_ALL_NUMBERS')}
                                    className="w-full px-4 py-2 bg-red-800 text-white font-bold rounded-md hover:bg-red-900">
                                【高危】一键清除所有号码信息
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <EditOrderModal isOpen={isEditModalOpen} onClose={handleCloseModal} numberData={selectedNumber}
                            onSave={(id, data) => handleSave(id, data)}/>
        </div>
    );
}
