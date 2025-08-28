"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { User, Organization, UserOrganization, Role } from '@prisma/client';
import { ENUM_TRANSLATIONS } from '@/lib/utils';

type UserWithOrganizations = User & {
  organizations: (UserOrganization & {
    organization: Organization;
  })[];
};

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserWithOrganizations;
  onSave: () => Promise<void>;
}

interface EditUserForm {
  name: string;
  username: string;
  email: string;
  phone: string;
  password?: string;
  confirmPassword?: string;
}

interface UserOrgData {
  id: string;
  organizationId: string;
  role: 'SCHOOL_ADMIN' | 'MARKETER';
  organization: Organization;
}

export const EditUserModal = ({ isOpen, onClose, user, onSave }: EditUserModalProps) => {
  const { data: session } = useSession();
  const [formData, setFormData] = useState<EditUserForm>({
    name: '',
    username: '',
    email: '',
    phone: ''
  });
  const [userOrganizations, setUserOrganizations] = useState<UserOrgData[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [newOrgId, setNewOrgId] = useState('');
  const [newOrgRole, setNewOrgRole] = useState<'SCHOOL_ADMIN' | 'MARKETER'>('MARKETER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changePassword, setChangePassword] = useState(false);

  // 获取组织列表
  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/organizations?type=SCHOOL');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  }, []);

  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        phone: user.phone || ''
      });
      
      // 设置用户组织关系
      const orgData = user.organizations.map(uo => ({
        id: uo.id,
        organizationId: uo.organizationId,
        role: uo.role as 'SCHOOL_ADMIN' | 'MARKETER',
        organization: uo.organization
      }));
      setUserOrganizations(orgData);
      
      fetchOrganizations();
    }
  }, [isOpen, user, fetchOrganizations]);

  if (!isOpen || !user) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setError(null);
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  };

  // 添加组织关系
  const handleAddOrganization = async () => {
    if (!newOrgId) {
      setError('请选择要添加的组织');
      return;
    }

    if (userOrganizations.some(uo => uo.organizationId === newOrgId)) {
      setError('该用户已在此组织中');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/user-organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          organizationIds: [newOrgId], // ✅ 修复：改为数组格式
          role: newOrgRole
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '添加组织关系失败');
      }

      const result = await response.json();
      const organization = organizations.find(org => org.id === newOrgId);
      
      if (organization && result.userOrganizations && result.userOrganizations.length > 0) {
        const newUserOrg = result.userOrganizations[0]; // 取第一个结果
        setUserOrganizations(prev => [...prev, {
          id: newUserOrg.id,
          organizationId: newOrgId,
          role: newOrgRole,
          organization
        }]);
      }

      setNewOrgId('');
      setNewOrgRole('MARKETER');
      setError(null);
    } catch (err) {
      console.error('Error adding organization:', err);
      setError(err instanceof Error ? err.message : '添加组织关系失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 更新组织角色
  const handleUpdateRole = async (userOrgId: string, newRole: string) => {
    try {
      setIsLoading(true);
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

      setUserOrganizations(prev => 
        prev.map(uo => 
          uo.id === userOrgId 
            ? { ...uo, role: newRole as 'SCHOOL_ADMIN' | 'MARKETER' }
            : uo
        )
      );
      setError(null);
    } catch (err) {
      console.error('Error updating role:', err);
      setError(err instanceof Error ? err.message : '更新角色失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 移除组织关系
  const handleRemoveOrganization = async (userOrgId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/user-organizations/${userOrgId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '移除组织关系失败');
      }

      setUserOrganizations(prev => prev.filter(uo => uo.id !== userOrgId));
      setError(null);
    } catch (err) {
      console.error('Error removing organization:', err);
      setError(err instanceof Error ? err.message : '移除组织关系失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
  
    // 表单验证 - 只验证必填字段：姓名、手机号
    if (!formData.name.trim()) {
      setError('请输入用户姓名');
      return;
    }
    if (!formData.phone.trim()) {
      setError('请输入手机号');
      return;
    }
    if (!validatePhone(formData.phone.trim())) {
      setError('请输入有效的手机号');
      return;
    }
  
    // 邮箱格式验证（仅在填写时验证）
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setError('请输入有效的邮箱地址');
        return;
      }
    }
  
    // 密码验证
    if (changePassword) {
      if (!formData.password) {
        setError('请输入新密码');
        return;
      }
      if (formData.password.length < 6) {
        setError('密码长度至少为6位');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
    }
  
    try {
      setIsLoading(true);
      
      // 修复：正确构建请求数据
      const requestData = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        ...(formData.username.trim() && { username: formData.username.trim() }),
        ...(formData.email.trim() && { email: formData.email.trim() }),
        ...(changePassword && formData.password && { password: formData.password })
      };
  
      // 修复：正确发送请求
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新用户失败');
      }

      await onSave();
      onClose();
    } catch (err) {
      console.error('Error updating user:', err);
      setError(err instanceof Error ? err.message : '更新用户失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-in fade-in-90 slide-in-from-bottom-10 duration-500 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl"
        >
          &times;
        </button>
        
        <h2 className="text-2xl font-bold mb-4">编辑用户信息</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">基本信息</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  用户姓名 *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  用户名
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="用于登录的用户名（可选）"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱地址
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="邮箱地址（可选）"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  手机号 *
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* 组织管理 - 超级管理员不显示，且不能编辑自己的组织信息 */}
          {user.role !== 'SUPER_ADMIN' && session?.user?.id !== user.id && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">组织管理</h3>
            
            {/* 当前组织列表 */}
            {userOrganizations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">当前组织</h4>
                {userOrganizations.map((userOrg) => (
                  <div key={userOrg.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex-1">
                      <span className="font-medium">{userOrg.organization.name}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        ({ENUM_TRANSLATIONS.OrgType[userOrg.organization.type as keyof typeof ENUM_TRANSLATIONS.OrgType]})
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <select
                        value={userOrg.role}
                        onChange={(e) => handleUpdateRole(userOrg.id, e.target.value)}
                        className="text-sm p-1 border border-gray-300 rounded"
                        disabled={isLoading}
                      >
                        <option value="MARKETER">{ENUM_TRANSLATIONS.Role.MARKETER}</option>
                        <option value="SCHOOL_ADMIN">{ENUM_TRANSLATIONS.Role.SCHOOL_ADMIN}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveOrganization(userOrg.id)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-800 text-sm px-2 py-1 disabled:opacity-50"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          
            {/* 添加新组织 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">添加组织</h4>
              <div className="flex space-x-2">
                <select
                  value={newOrgId}
                  onChange={(e) => setNewOrgId(e.target.value)}
                  className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">选择组织</option>
                  {organizations
                    .filter(org => !userOrganizations.some(uo => uo.organizationId === org.id))
                    .map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({ENUM_TRANSLATIONS.OrgType[org.type as keyof typeof ENUM_TRANSLATIONS.OrgType]})
                      </option>
                    ))}
                  </select>
                  <select
                    value={newOrgRole}
                    onChange={(e) => setNewOrgRole(e.target.value as 'SCHOOL_ADMIN' | 'MARKETER')}
                    className="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="MARKETER">{ENUM_TRANSLATIONS.Role.MARKETER}</option>
                    <option value="SCHOOL_ADMIN">{ENUM_TRANSLATIONS.Role.SCHOOL_ADMIN}</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddOrganization}
                    disabled={isLoading || !newOrgId}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300"
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 密码修改 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">密码管理</h3>
            
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="changePassword"
                checked={changePassword}
                onChange={(e) => setChangePassword(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="changePassword" className="text-sm font-medium text-gray-700">
                修改密码
              </label>
            </div>

            {changePassword && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    新密码 *
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password || ''}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    minLength={6}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    确认密码 *
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword || ''}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    minLength={6}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-300"
            >
              {isLoading ? '保存中...' : '保存更改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};