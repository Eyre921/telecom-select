"use client";

import { useState } from 'react';
import { Role } from '@prisma/client';
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
}

export const CreateUserModal = ({ isOpen, onClose, onSave }: CreateUserModalProps) => {
  const [formData, setFormData] = useState<CreateUserForm>({
    name: '',
    username: '',
    phone: '',
    email: '',
    role: 'MARKETER',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 表单验证
    if (!formData.name.trim()) {
      setError('请输入用户姓名');
      return;
    }
    if (!formData.username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!formData.phone.trim()) {
      setError('请输入手机号');
      return;
    }
    if (!formData.email.trim()) {
      setError('请输入邮箱地址');
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

    // 手机号格式验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(formData.phone.trim())) {
      setError('请输入有效的手机号');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          username: formData.username.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          role: formData.role,
          password: formData.password
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '创建用户失败');
      }

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
        confirmPassword: ''
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
              用户名 *
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="用于登录的用户名"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
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
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              邮箱地址 *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              用户角色 *
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
              <option value="SUPER_ADMIN">{ENUM_TRANSLATIONS.Role.SUPER_ADMIN}</option>
            </select>
          </div>

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