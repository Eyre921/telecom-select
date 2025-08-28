"use client";

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Organization, UserOrganization } from '@prisma/client';
import { ENUM_TRANSLATIONS } from '@/lib/utils';
import { SchoolSelector } from '@/components/admin/SchoolSelector';
import { CreateUserModal } from '@/components/admin/CreateUserModal';
import { EditUserModal } from '@/components/admin/EditUserModal';
import { UserOrganizationModal } from '@/components/admin/UserOrganizationModal';
import { OrganizationHierarchy } from '@/components/admin/OrganizationHierarchy';

// 扩展用户类型，包含组织信息
type UserWithOrganizations = User & {
  organizations: (UserOrganization & {
    organization: Organization;
  })[];
};

type SortConfig = { field: keyof User; direction: 'asc' | 'desc' };

const ITEMS_PER_PAGE = 20;

// 加载动画组件
const FullPageSpinner = () => (
  <div className="fixed inset-0 bg-white bg-opacity-75 z-50 flex justify-center items-center">
    <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-500"></div>
  </div>
);

// 在 UsersTable 组件中添加新的列
const UsersTable = ({
  users,
  onEdit,
  onDelete,
  onManageOrganizations,
  onSort,
  sortConfig,
  isAdmin
}: {
  users: UserWithOrganizations[];
  onEdit: (user: UserWithOrganizations) => void;
  onDelete: (id: string) => void;
  onManageOrganizations: (user: UserWithOrganizations) => void;
  onSort: (field: keyof User) => void;
  sortConfig: SortConfig;
  isAdmin: boolean;
}) => {
  return (
    <div className="bg-white shadow overflow-x-auto rounded-md">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              onClick={() => onSort('name')}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              姓名
              {sortConfig.field === 'name' && (
                <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
            <th
              onClick={() => onSort('username')}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              用户名
              {sortConfig.field === 'username' && (
                <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
            <th
              onClick={() => onSort('phone')}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              手机号
              {sortConfig.field === 'phone' && (
                <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
            <th
              onClick={() => onSort('email')}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              邮箱
              {sortConfig.field === 'email' && (
                <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
            <th
              onClick={() => onSort('role')}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              角色
              {sortConfig.field === 'role' && (
                <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              所属组织层级
            </th>
            <th
              onClick={() => onSort('createdAt')}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              创建时间
              {sortConfig.field === 'createdAt' && (
                <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
            <th className="relative px-6 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-6 py-20 text-center text-gray-500">
                未找到任何用户。
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.username || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.phone || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.email || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.role === 'SUPER_ADMIN' ? 'bg-red-100 text-red-800' :
                    user.role === 'SCHOOL_ADMIN' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {ENUM_TRANSLATIONS.Role[user.role] || user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="space-y-1">
                    {user.organizations.length === 0 ? (
                      <span className="text-gray-400">未分配</span>
                    ) : (
                      user.organizations.map((userOrg) => (
                        <div key={userOrg.id} className="flex items-center space-x-2">
                          <span className="text-sm">{userOrg.organization.name}</span>
                          <span className={`inline-flex px-1 py-0.5 text-xs font-medium rounded ${
                            userOrg.role === 'SUPER_ADMIN' ? 'bg-red-100 text-red-700' :
                            userOrg.role === 'SCHOOL_ADMIN' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {ENUM_TRANSLATIONS.Role[userOrg.role]}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(user.createdAt).toLocaleString('zh-CN')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    onClick={() => onEdit(user)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => onManageOrganizations(user)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    组织管理
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => onDelete(user.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      删除
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

// 分页组件
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
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

// 主页面组件
export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'SCHOOL_ADMIN';

  // 权限检查
  useEffect(() => {
    if (status === 'loading') return; // 还在加载中
    
    if (status === 'unauthenticated') {
      // 未登录，重定向到登录页
      router.push('/signin?callbackUrl=/admin/users');
      return;
    }
    
    if (session && !isAdmin) {
      // 已登录但无权限，重定向到dashboard
      router.push('/admin/dashboard');
      return;
    }
  }, [session, status, isAdmin, router]);

  // 如果正在检查权限或重定向中，显示加载状态
  if (status === 'loading' || (session && !isAdmin)) {
    return <FullPageSpinner />;
  }

  // 如果未登录，不渲染任何内容（将重定向）
  if (!session) {
    return null;
  }
  const [users, setUsers] = useState<UserWithOrganizations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'createdAt', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  
  // 筛选状态
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  
  // 模态框状态
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithOrganizations | null>(null);

  // 获取用户列表
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        sortField: sortConfig.field,
        sortDirection: sortConfig.direction,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedSchoolId && { schoolId: selectedSchoolId }),
        ...(selectedDepartmentId && { departmentId: selectedDepartmentId }),
        ...(selectedRole && { role: selectedRole }),
      });
  
      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) {
        throw new Error('获取用户列表失败');
      }
  
      const data = await response.json();
      setUsers(data.users || []);
      
      // 修复分页计算，确保total是有效数字
      const total = typeof data.total === 'number' && !isNaN(data.total) ? data.total : 0;
      const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
      setTotalPages(totalPages);
      
      // 如果当前页超出范围，重置到第一页
      if (currentPage > totalPages) {
        setCurrentPage(1);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : '获取用户列表失败');
      // 错误时重置分页
      setUsers([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, sortConfig, searchTerm, selectedSchoolId, selectedDepartmentId, selectedRole]);

  // 修复处理搜索函数
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    // 移除直接调用fetchUsers，让useEffect处理
  }, []);
  
  // 修复处理清除搜索函数
  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setSelectedSchoolId('');
    setSelectedDepartmentId('');
    setSelectedRole('');
    setCurrentPage(1);
  }, []);
  
  // 修复处理排序函数
  const handleSort = useCallback((field: keyof User) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1);
  }, []);
  
  // 确保useEffect正确响应所有依赖变化
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  
  // 添加一个单独的effect来处理筛选条件变化
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      fetchUsers();
    }
  }, [searchTerm, selectedSchoolId, selectedDepartmentId, selectedRole, sortConfig]);

  // 处理编辑用户
  const handleEdit = (user: UserWithOrganizations) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  // 处理删除用户
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个用户吗？此操作不可撤销。')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除用户失败');
      }

      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert(err instanceof Error ? err.message : '删除用户失败');
    }
  };

  // 处理组织管理
  const handleManageOrganizations = (user: UserWithOrganizations) => {
    setSelectedUser(user);
    setIsOrgModalOpen(true);
  };

  // 处理用户保存
  const handleUserSave = async () => {
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    await fetchUsers();
  };

  // 处理组织关系保存
  const handleOrgSave = async () => {
    setIsOrgModalOpen(false);
    await fetchUsers();
  };

  if (isLoading && users.length === 0) {
    return <FullPageSpinner />;
  }

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      {/* 页面标题 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
            <p className="mt-1 text-sm text-gray-600">
              管理系统用户、角色分配和组织关系
            </p>
          </div>
          <div className="flex space-x-3">
            <Link
              href="/admin/dashboard"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              返回仪表盘
            </Link>
            {isAdmin && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                创建用户
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* 搜索和筛选 */}
      <div className="mb-6 space-y-4">
        <div className="bg-white p-4 rounded-lg shadow space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="按姓名、用户名、手机号或邮箱搜索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="w-48">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">全部角色</option>
                <option value="SUPER_ADMIN">超级管理员</option>
                <option value="SCHOOL_ADMIN">学校管理员</option>
                <option value="MARKETER">营销人员</option>
              </select>
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-400"
              disabled={isLoading}
            >
              {isLoading ? '搜索中...' : '搜索'}
            </button>
            <button
              onClick={handleClearSearch}
              className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-md hover:bg-gray-600"
            >
              清除
            </button>
          </div>
        </div>

        {/* 学校和院系筛选 */}
        <SchoolSelector
          selectedSchoolId={selectedSchoolId}
          selectedDepartmentId={selectedDepartmentId}
          onSchoolChange={setSelectedSchoolId}
          onDepartmentChange={setSelectedDepartmentId}
          showResetButton={true}
          onReset={handleClearSearch}
        />
      </div>

      {/* 用户表格 */}
      <UsersTable
        users={users}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onManageOrganizations={handleManageOrganizations}
        onSort={handleSort}
        sortConfig={sortConfig}
        isAdmin={isAdmin || false}
      />

      {/* 分页 */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* 模态框 */}
      {isCreateModalOpen && (
        <CreateUserModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleUserSave}
        />
      )}

      {isEditModalOpen && selectedUser && (
        <EditUserModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          user={selectedUser}
          onSave={handleUserSave}
        />
      )}

      {isOrgModalOpen && selectedUser && (
        <UserOrganizationModal
          isOpen={isOrgModalOpen}
          onClose={() => setIsOrgModalOpen(false)}
          user={selectedUser}
          onSave={handleOrgSave}
        />
      )}
    </div>
  );
}