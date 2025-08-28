"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Role, Organization } from '@prisma/client';
import { ENUM_TRANSLATIONS } from '@/lib/utils';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
}

interface CreateUserForm {
  name: string;
  username: string;
  phone: string;
  email: string;
  role: Role;
  password: string;
  confirmPassword: string;
  organizationId: string;
  // 删除 organizationRole 字段
}

export const CreateUserModal = ({ isOpen, onClose, onSave }: CreateUserModalProps) => {
  const { data: session } = useSession();
  const [formData, setFormData] = useState<CreateUserForm>({
    name: '',
    username: '',
    phone: '',
    email: '',
    role: 'MARKETER',
    password: '',
    confirmPassword: '',
    organizationId: ''
    // 删除 organizationRole: 'MARKETER'
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 检查当前用户是否可以创建超级管理员
  const canCreateSuperAdmin = session?.user?.role === 'SUPER_ADMIN';

  // 获取组织列表
  useEffect(() => {
    if (isOpen) {
      fetchOrganizations();
    }
  }, [isOpen]);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/admin/organizations?type=SCHOOL');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      }
    } catch (err) {
      console.error('获取组织列表失败:', err);
    }
  };

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  // 修复：定义具体的类型而不是使用 any
  // 修复：定义具体的类型而不是使用 any
  interface CreateUserRequest {
    name: string;
    phone: string;
    role: string;
    password: string;
    username?: string;
    email?: string;
    organizationId?: string;
    organizationRole?: string;
  }
  
  // 添加缺失的CreateUserResponse接口定义
  interface CreateUserResponse {
    success?: boolean;
    error?: string;
    user?: {
      id: string;
      username: string;
      name: string;
    };
  }
  
  // 在 handleSubmit 函数中
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
  
    // 权限验证：师大管理员不能创建超级管理员
    if (formData.role === 'SUPER_ADMIN' && !canCreateSuperAdmin) {
      setError('您没有权限创建超级管理员');
      return;
    }
  
    // 表单验证 - 只验证必填字段：姓名、手机号、密码
    if (!formData.name.trim()) {
      setError('请输入用户姓名');
      return;
    }
    if (!formData.phone.trim()) {
      setError('请输入手机号');
      return;
    }
    if (!formData.password) {
      setError('请输入密码');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (formData.password.length < 6) {
      setError('密码长度至少为6位');
      return;
    }
  
    // 角色和组织验证
    if (formData.role !== 'SUPER_ADMIN' && !formData.organizationId) {
      setError('非超级管理员必须分配到组织');
      return;
    }
    if (formData.role === 'SUPER_ADMIN' && formData.organizationId) {
      setError('超级管理员不能分配到组织');
      return;
    }
  
    // 手机号格式验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(formData.phone.trim())) {
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
  
    try {
      setIsLoading(true);
      const requestData: CreateUserRequest = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        role: formData.role,
        password: formData.password,
        // 只有非超级管理员才传递组织信息，组织内角色直接使用用户类型
        ...(formData.role !== 'SUPER_ADMIN' && {
          organizationId: formData.organizationId,
          organizationRole: formData.role // 直接使用用户类型作为组织内角色
        })
      };
  
      // 只有在填写了用户名和邮箱时才传递
      if (formData.username.trim()) {
        requestData.username = formData.username.trim();
      }
      if (formData.email.trim()) {
        requestData.email = formData.email.trim();
      }
  
      // 修复第133行：正确处理fetch响应
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
  
      if (!response.ok) {
        const errorData: CreateUserResponse = await response.json();
        throw new Error(errorData.error || '创建用户失败');
      }
  
      // 如果需要处理成功响应的数据，也要正确类型化
      const result: CreateUserResponse = await response.json();
      await onSave();
      onClose();
      
      // 重置表单
      setFormData({
        name: '',
        username: '',
        phone: '',
        email: '',
        role: 'MARKETER',
        password: '',
        confirmPassword: '',
        organizationId: ''
        // 删除 organizationRole: 'MARKETER'
      });
    } catch (err) {
      console.error('Error creating user:', err);
      setError(err instanceof Error ? err.message : '创建用户失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative animate-in fade-in-90 slide-in-from-bottom-10 duration-500 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl"
        >
          &times;
        </button>
        
        <h2 className="text-2xl font-bold mb-4">创建新用户</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="用于登录的用户名（可选，为空时自动生成）"
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
              placeholder="请输入11位手机号"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              用户类型 *
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="MARKETER">{ENUM_TRANSLATIONS.Role.MARKETER}</option>
              <option value="SCHOOL_ADMIN">{ENUM_TRANSLATIONS.Role.SCHOOL_ADMIN}</option>
              {canCreateSuperAdmin && (
                <option value="SUPER_ADMIN">{ENUM_TRANSLATIONS.Role.SUPER_ADMIN}</option>
              )}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {canCreateSuperAdmin 
                ? "超级管理员独立存在，不分配到具体组织" 
                : "您只能创建营销人员和学校管理员"}
            </p>
          </div>

          {/* 组织选择 - 只有非超级管理员才显示 */}
          {formData.role !== 'SUPER_ADMIN' && (
            <div>
              <label htmlFor="organizationId" className="block text-sm font-medium text-gray-700 mb-1">
                所属组织 *
              </label>
              <select
                id="organizationId"
                name="organizationId"
                value={formData.organizationId}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">请选择组织</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({ENUM_TRANSLATIONS.OrgType[org.type as keyof typeof ENUM_TRANSLATIONS.OrgType]})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 删除整个组织内角色字段 */}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              密码 *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
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
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
              minLength={6}
            />
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
              {isLoading ? '创建中...' : '创建用户'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};