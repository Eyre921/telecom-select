"use client";

import { useState, useEffect, useCallback } from 'react';
import { User, Organization, UserOrganization, Role } from '@prisma/client';
import { ENUM_TRANSLATIONS } from '@/lib/utils';

type UserWithOrganizations = User & {
  organizations: (UserOrganization & {
    organization: Organization;
  })[];
};

interface UserOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserWithOrganizations;
  onSave: () => Promise<void>;
}

interface OrganizationOption {
  id: string;
  name: string;
  type: string;
  parentId?: string;
}

export const UserOrganizationModal = ({ isOpen, onClose, user, onSave }: UserOrganizationModalProps) => {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [userOrganizations, setUserOrganizations] = useState<(UserOrganization & { organization: Organization })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newOrgId, setNewOrgId] = useState('');
  const [newOrgRole, setNewOrgRole] = useState<Role>('MARKETER');

  // 获取所有组织
  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      }
    } catch (err) {
      console.error('获取组织列表失败:', err);
    }
  }, []);

  // 获取用户组织关系
  const fetchUserOrganizations = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/user-organizations?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setUserOrganizations(data.userOrganizations);
      }
    } catch (err) {
      console.error('获取用户组织关系失败:', err);
    }
  }, [user.id]);

  useEffect(() => {
    if (isOpen) {
      fetchOrganizations();
      fetchUserOrganizations();
      setUserOrganizations(user.organizations);
    }
  }, [isOpen, fetchOrganizations, fetchUserOrganizations, user.organizations]);

  if (!isOpen) return null;

  // 添加组织关系
  const handleAddOrganization = async () => {
    if (!newOrgId) {
      setError('请选择组织');
      return;
    }

    // 检查是否已存在
    if (userOrganizations.some(uo => uo.organizationId === newOrgId)) {
      setError('用户已在该组织中');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/user-organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          organizationIds: [newOrgId], // 修改为数组格式
          role: newOrgRole
        }),
      });

      // 修复添加组织关系的错误处理
      if (!response.ok) {
        let errorMessage = '添加组织关系失败';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            errorMessage = await response.text() || errorMessage;
          }
        } catch (parseError) {
          // 如果解析失败，使用默认错误消息
          console.warn('Failed to parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      // 同样修复更新角色的错误处理
      if (!response.ok) {
        let errorMessage = '更新角色失败';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            errorMessage = await response.text() || errorMessage;
          }
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      // 同样修复移除组织关系的错误处理
      if (!response.ok) {
        let errorMessage = '移除组织关系失败';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            errorMessage = await response.text() || errorMessage;
          }
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      await fetchUserOrganizations();
      setNewOrgId('');
      setNewOrgRole('MARKETER');
    } catch (err) {
      console.error('Error adding organization:', err);
      setError(err instanceof Error ? err.message : '添加组织关系失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 更新角色
  const handleUpdateRole = async (userOrgId: string, newRole: Role) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/user-organizations/${userOrgId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新角色失败');
      }

      await fetchUserOrganizations();
    } catch (err) {
      console.error('Error updating role:', err);
      setError(err instanceof Error ? err.message : '更新角色失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 移除组织关系
  const handleRemoveOrganization = async (userOrgId: string) => {
    if (!confirm('确定要移除该组织关系吗？')) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/user-organizations/${userOrgId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '移除组织关系失败');
      }

      await fetchUserOrganizations();
    } catch (err) {
      console.error('Error removing organization:', err);
      setError(err instanceof Error ? err.message : '移除组织关系失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 获取可选择的组织（排除已分配的，且只显示学校级别的组织）
  const availableOrganizations = organizations.filter(
    org => !userOrganizations.some(uo => uo.organizationId === org.id) && org.type === 'SCHOOL'
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-in fade-in-90 slide-in-from-bottom-10 duration-500">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl"
        >
          &times;
        </button>
        
        <h2 className="text-2xl font-bold mb-4">管理用户组织关系</h2>
        <p className="text-gray-600 mb-6">用户：{user.name} ({user.email})</p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* 添加新组织关系 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium mb-3">添加组织关系</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择组织</label>
              <select
                value={newOrgId}
                onChange={(e) => setNewOrgId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                <option value="">请选择组织</option>
                {availableOrganizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({ENUM_TRANSLATIONS.OrgType[org.type as keyof typeof ENUM_TRANSLATIONS.OrgType]})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
              <select
                value={newOrgRole}
                onChange={(e) => setNewOrgRole(e.target.value as Role)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                <option value="MARKETER">{ENUM_TRANSLATIONS.Role.MARKETER}</option>
                <option value="SCHOOL_ADMIN">{ENUM_TRANSLATIONS.Role.SCHOOL_ADMIN}</option>
                <option value="SUPER_ADMIN">{ENUM_TRANSLATIONS.Role.SUPER_ADMIN}</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddOrganization}
                disabled={isLoading || !newOrgId}
                className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isLoading ? '添加中...' : '添加'}
              </button>
            </div>
          </div>
        </div>

        {/* 现有组织关系列表 */}
        <div>
          <h3 className="text-lg font-medium mb-3">现有组织关系</h3>
          {userOrganizations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              该用户尚未分配到任何组织
            </div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {userOrganizations.map((userOrg) => (
                <div key={userOrg.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{userOrg.organization.name}</div>
                    <div className="text-sm text-gray-500">
                      {ENUM_TRANSLATIONS.OrgType[userOrg.organization.type as keyof typeof ENUM_TRANSLATIONS.OrgType]}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <select
                      value={userOrg.role}
                      onChange={(e) => handleUpdateRole(userOrg.id, e.target.value as Role)}
                      className="p-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                      disabled={isLoading}
                    >
                      <option value="MARKETER">{ENUM_TRANSLATIONS.Role.MARKETER}</option>
                      <option value="SCHOOL_ADMIN">{ENUM_TRANSLATIONS.Role.SCHOOL_ADMIN}</option>
                      <option value="SUPER_ADMIN">{ENUM_TRANSLATIONS.Role.SUPER_ADMIN}</option>
                    </select>
                    <button
                      onClick={() => handleRemoveOrganization(userOrg.id)}
                      disabled={isLoading}
                      className="text-red-600 hover:text-red-800 disabled:text-red-300"
                    >
                      移除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            关闭
          </button>
          <button
            onClick={async () => {
              await onSave();
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};