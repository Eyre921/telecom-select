"use client";

import { useState, useEffect, useCallback } from 'react';
import { Organization, OrgType } from '@prisma/client';
import { ENUM_TRANSLATIONS } from '@/lib/utils';

type OrganizationWithRelations = Organization & {
  parent?: { id: string; name: string; type: string } | null;
  children?: { id: string; name: string; type: string }[];
};

interface OrganizationManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
}

export const OrganizationManagementModal = ({ isOpen, onClose, onSave }: OrganizationManagementModalProps) => {
  const [organizations, setOrganizations] = useState<OrganizationWithRelations[]>([]);
  const [schools, setSchools] = useState<OrganizationWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationWithRelations | null>(null);
  const [newOrgData, setNewOrgData] = useState({
    name: '',
    type: 'SCHOOL' as OrgType,
    description: '',
    parentId: ''
  });

  // 获取所有组织
  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
        setSchools(data.filter((org: OrganizationWithRelations) => org.type === 'SCHOOL'));
      } else {
        setError('获取组织列表失败');
      }
    } catch (err) {
      console.error('获取组织列表失败:', err);
      setError('获取组织列表失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchOrganizations();
    }
  }, [isOpen, fetchOrganizations]);

  if (!isOpen) return null;

  // 创建组织
  const handleCreateOrganization = async () => {
    if (!newOrgData.name) {
      setError('组织名称为必填项');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newOrgData.name,
          type: newOrgData.type,
          description: newOrgData.description || null,
          parentId: newOrgData.parentId || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '创建组织失败');
      }

      await fetchOrganizations();
      setIsCreateModalOpen(false);
      setNewOrgData({ name: '', type: 'SCHOOL', description: '', parentId: '' });
    } catch (err) {
      console.error('Error creating organization:', err);
      setError(err instanceof Error ? err.message : '创建组织失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 更新组织
  const handleUpdateOrganization = async () => {
    if (!selectedOrg || !selectedOrg.name) {
      setError('组织名称为必填项');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/organizations/${selectedOrg.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: selectedOrg.name,
          description: selectedOrg.description || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新组织失败');
      }

      await fetchOrganizations();
      setIsEditModalOpen(false);
      setSelectedOrg(null);
    } catch (err) {
      console.error('Error updating organization:', err);
      setError(err instanceof Error ? err.message : '更新组织失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 删除组织
  const handleDeleteOrganization = async (org: OrganizationWithRelations) => {
    if (!confirm(`确定要删除组织"${org.name}"吗？此操作不可撤销。`)) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '删除组织失败');
      }

      await fetchOrganizations();
    } catch (err) {
      console.error('Error deleting organization:', err);
      setError(err instanceof Error ? err.message : '删除组织失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 打开编辑模态框
  const handleEditOrganization = (org: OrganizationWithRelations) => {
    setSelectedOrg({ ...org });
    setIsEditModalOpen(true);
  };

  // 按类型分组组织
  const schoolOrgs = organizations.filter(org => org.type === 'SCHOOL');
  const departmentOrgs = organizations.filter(org => org.type === 'DEPARTMENT');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 relative animate-in fade-in-90 slide-in-from-bottom-10 duration-500 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl"
        >
          &times;
        </button>
        
        <h2 className="text-2xl font-bold mb-4">组织管理</h2>
        <p className="text-gray-600 mb-6">管理学校和院系组织结构</p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="mb-6 flex space-x-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          >
            创建组织
          </button>
        </div>

        {/* 学校列表 */}
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-3">学校 ({schoolOrgs.length})</h3>
          {schoolOrgs.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              暂无学校组织
            </div>
          ) : (
            <div className="space-y-3">
              {schoolOrgs.map((school) => {
                const schoolDepts = departmentOrgs.filter(dept => dept.parentId === school.id);
                return (
                  <div key={school.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-lg">{school.name}</div>
                        {school.description && (
                          <div className="text-sm text-gray-500">{school.description}</div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditOrganization(school)}
                          disabled={isLoading}
                          className="text-blue-600 hover:text-blue-800 disabled:text-blue-300"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteOrganization(school)}
                          disabled={isLoading}
                          className="text-red-600 hover:text-red-800 disabled:text-red-300"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    
                    {/* 院系列表 */}
                    {schoolDepts.length > 0 && (
                      <div className="ml-4 mt-3 border-l-2 border-gray-200 pl-4">
                        <div className="text-sm font-medium text-gray-700 mb-2">院系 ({schoolDepts.length})</div>
                        <div className="space-y-2">
                          {schoolDepts.map((dept) => (
                            <div key={dept.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex-1">
                                <div className="font-medium">{dept.name}</div>
                                {dept.description && (
                                  <div className="text-xs text-gray-500">{dept.description}</div>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleEditOrganization(dept)}
                                  disabled={isLoading}
                                  className="text-blue-600 hover:text-blue-800 disabled:text-blue-300 text-sm"
                                >
                                  编辑
                                </button>
                                <button
                                  onClick={() => handleDeleteOrganization(dept)}
                                  disabled={isLoading}
                                  className="text-red-600 hover:text-red-800 disabled:text-red-300 text-sm"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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

      {/* 创建组织模态框 */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-60 flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">创建组织</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">组织名称 *</label>
                <input
                  type="text"
                  value={newOrgData.name}
                  onChange={(e) => setNewOrgData({ ...newOrgData, name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入组织名称"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">组织类型 *</label>
                <select
                  value={newOrgData.type}
                  onChange={(e) => {
                    const type = e.target.value as OrgType;
                    setNewOrgData({ 
                      ...newOrgData, 
                      type,
                      parentId: type === 'SCHOOL' ? '' : newOrgData.parentId
                    });
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="SCHOOL">{ENUM_TRANSLATIONS.OrgType.SCHOOL}</option>
                  <option value="DEPARTMENT">{ENUM_TRANSLATIONS.OrgType.DEPARTMENT}</option>
                </select>
              </div>
              
              {newOrgData.type === 'DEPARTMENT' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">所属学校 *</label>
                  <select
                    value={newOrgData.parentId}
                    onChange={(e) => setNewOrgData({ ...newOrgData, parentId: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">请选择学校</option>
                    {schools.map(school => (
                      <option key={school.id} value={school.id}>{school.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={newOrgData.description}
                  onChange={(e) => setNewOrgData({ ...newOrgData, description: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="请输入组织描述（可选）"
                />
              </div>
            </div>
            
            <div className="pt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setNewOrgData({ name: '', type: 'SCHOOL', description: '', parentId: '' });
                  setError(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateOrganization}
                disabled={isLoading || !newOrgData.name || (newOrgData.type === 'DEPARTMENT' && !newOrgData.parentId)}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isLoading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑组织模态框 */}
      {isEditModalOpen && selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-60 flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">编辑组织</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">组织名称 *</label>
                <input
                  type="text"
                  value={selectedOrg.name}
                  onChange={(e) => setSelectedOrg({ ...selectedOrg, name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入组织名称"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">组织类型</label>
                <input
                  type="text"
                  value={ENUM_TRANSLATIONS.OrgType[selectedOrg.type as keyof typeof ENUM_TRANSLATIONS.OrgType]}
                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-100"
                  disabled
                />
              </div>
              
              {selectedOrg.parent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">所属学校</label>
                  <input
                    type="text"
                    value={selectedOrg.parent.name}
                    className="w-full p-2 border border-gray-300 rounded-md bg-gray-100"
                    disabled
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={selectedOrg.description || ''}
                  onChange={(e) => setSelectedOrg({ ...selectedOrg, description: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="请输入组织描述（可选）"
                />
              </div>
            </div>
            
            <div className="pt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedOrg(null);
                  setError(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleUpdateOrganization}
                disabled={isLoading || !selectedOrg.name}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isLoading ? '更新中...' : '更新'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};