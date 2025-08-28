'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Organization, UserOrganization } from '@prisma/client';
import { CreateUserModal } from '@/components/admin/CreateUserModal';
import { EditUserModal } from '@/components/admin/EditUserModal';
import { UserOrganizationModal } from '@/components/admin/UserOrganizationModal';
import { OrganizationManagementModal } from '@/components/admin/OrganizationManagementModal';

// 修改类型定义，与UserOrganizationModal保持一致
interface UserWithOrganizations extends User {
  organizations: (UserOrganization & {
    organization: Organization;
  })[];
}

const ITEMS_PER_PAGE = 10;

const ENUM_TRANSLATIONS = {
  Role: {
    SUPER_ADMIN: '超级管理员',
    SCHOOL_ADMIN: '学校管理员',
    MARKETER: '营销人员'
  },
  OrgType: {
    SCHOOL: '学校',
    DEPARTMENT: '院系'
  }
};

// 加载动画组件
const FullPageSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
  </div>
);

// 用户表格组件
const UsersTable = ({
  users,
  onEdit,
  onDelete,
  onManageOrganizations,
  isAdmin
}: {
  users: UserWithOrganizations[];
  onEdit: (user: UserWithOrganizations) => void;
  onDelete: (id: string) => void;
  onManageOrganizations: (user: UserWithOrganizations) => void;
  isAdmin: boolean;
}) => {
  if (users.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">暂无用户数据</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                姓名
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                用户名
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                邮箱
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                手机号
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                角色
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                所属组织
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                创建时间
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.username || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.phone || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800' :
                    user.role === 'SCHOOL_ADMIN' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {ENUM_TRANSLATIONS.Role[user.role as keyof typeof ENUM_TRANSLATIONS.Role]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.organizations.length > 0 ? (
                    <div className="space-y-1">
                      {user.organizations.map((userOrg) => (
                        <div key={userOrg.id} className="text-xs">
                          <span className="font-medium">{userOrg.organization.name}</span>
                          <span className="text-gray-400 ml-1">
                            ({ENUM_TRANSLATIONS.OrgType[userOrg.organization.type as keyof typeof ENUM_TRANSLATIONS.OrgType]})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">未分配</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => onEdit(user)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    编辑
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => onManageOrganizations(user)}
                        className="text-green-600 hover:text-green-900"
                      >
                        分配组织
                      </button>
                      <button
                        onClick={() => onDelete(user.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        删除
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const [searchTerm, setSearchTerm] = useState('');
  
  // 筛选状态
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [schools, setSchools] = useState<Organization[]>([]);
  
  // 模态框状态
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isOrgManagementModalOpen, setIsOrgManagementModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithOrganizations | null>(null);

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
  
  // 获取用户列表
  const fetchUsers = useCallback(async (page = currentPage, search = '', schoolId = '', role = '') => {
    try {
      setIsLoading(true);
      setError(null);
  
      const params = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        sortField: 'username', // 固定按用户名排序
        sortDirection: 'asc',
        ...(search && { search }),
        ...(schoolId && { organizationId: schoolId }),
        ...(role && { role }),
      });
  
      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) {
        throw new Error('获取用户列表失败');
      }
  
      const data = await response.json();
      setUsers(data.users || []);
      
      const total = typeof data.total === 'number' && !isNaN(data.total) ? data.total : 0;
      const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
      setTotalPages(totalPages);
      
      if (page > totalPages) {
        setCurrentPage(1);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : '获取用户列表失败');
      setUsers([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage]);
  
  // 处理搜索
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    fetchUsers(1, searchTerm, selectedSchoolId, selectedRole);
  }, [searchTerm, selectedSchoolId, selectedRole, fetchUsers]);
  
  // 处理清除搜索
  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setSelectedSchoolId('');
    setSelectedRole('');
    setCurrentPage(1);
    fetchUsers(1, '', '', '');
  }, [fetchUsers]);
  
  // 初始化数据
  useEffect(() => {
    fetchSchools();
    fetchUsers();
  }, [fetchSchools]);
  
  // 移除学校和角色筛选条件变化时的实时更新
  // 删除这个 useEffect：
  // useEffect(() => {
  //   if (currentPage !== 1) {
  //     setCurrentPage(1);
  //   } else {
  //     fetchUsers();
  //   }
  // }, [selectedSchoolId, selectedRole]);
  
  // 页码变化时获取数据
  useEffect(() => {
    fetchUsers(currentPage, searchTerm, selectedSchoolId, selectedRole);
  }, [currentPage]);
  
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

  // 处理整体组织管理
  const handleOrganizationManagement = () => {
    setIsOrgManagementModalOpen(true);
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

  // 处理组织管理保存
  const handleOrgManagementSave = async () => {
    setIsOrgManagementModalOpen(false);
    // 可能需要刷新相关数据
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
              <>
                <button
                  onClick={handleOrganizationManagement}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                >
                  组织管理
                </button>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                  创建用户
                </button>
              </>
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
      <div className="mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="按姓名、用户名、手机号或邮箱搜索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="w-48">
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">全部学校</option>
                {schools.map(school => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
            </div>
            <div className="w-48">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">全部角色</option>
                <option value="SUPER_ADMIN">超级管理员</option>
                <option value="SCHOOL_ADMIN">学校管理员</option>
                <option value="MARKETER">营销人员</option>
              </select>
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
              disabled={isLoading}
            >
              {isLoading ? '搜索中...' : '搜索'}
            </button>
            <button
              onClick={handleClearSearch}
              className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-md hover:bg-gray-600 transition-colors"
            >
              清除
            </button>
          </div>
        </div>
      </div>

      {/* 用户表格 */}
      <UsersTable
        users={users}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onManageOrganizations={handleManageOrganizations}
        isAdmin={isAdmin}
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
          user={selectedUser}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleUserSave}
        />
      )}

      {isOrgModalOpen && selectedUser && (
        <UserOrganizationModal
          isOpen={isOrgModalOpen}
          user={selectedUser}
          onClose={() => setIsOrgModalOpen(false)}
          onSave={handleOrgSave}
        />
      )}

      {isOrgManagementModalOpen && (
        <OrganizationManagementModal
          isOpen={isOrgManagementModalOpen}
          onClose={() => setIsOrgManagementModalOpen(false)}
          onSave={handleOrgManagementSave}
        />
      )}
    </div>
  );
}
