import React, { useState, useEffect } from 'react';
import { OrgType } from '@prisma/client';
import { Building2, GraduationCap, Users, Phone, CheckCircle, Clock } from 'lucide-react';

interface OrganizationWithStats {
  id: string;
  name: string;
  type: OrgType;
  description?: string | null;
  parentId?: string | null;
  children: OrganizationWithStats[];
  stats: {
    userCount: number;
    numberCount: number;
    availableNumbers: number;
    pendingReview: number;
  };
}

interface MultiTenantDashboardProps {
  className?: string;
}

const MultiTenantDashboard: React.FC<MultiTenantDashboardProps> = ({ className }) => {
  const [organizations, setOrganizations] = useState<OrganizationWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationWithStats | null>(null);

  useEffect(() => {
    fetchOrganizationHierarchy();
  }, []);

  const fetchOrganizationHierarchy = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/organizations/hierarchy');
      const result = await response.json();
      
      if (result.success) {
        setOrganizations(result.data);
      } else {
        setError(result.error || '获取组织数据失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
      console.error('获取组织层级失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const getOrgIcon = (type: OrgType) => {
    switch (type) {
      case 'SCHOOL':
        return <GraduationCap className="w-5 h-5" />;
      case 'DEPARTMENT':
        return <Building2 className="w-5 h-5" />;
      default:
        return <Building2 className="w-5 h-5" />;
    }
  };

  const getOrgColor = (type: OrgType) => {
    switch (type) {
      case 'SCHOOL':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'DEPARTMENT':
        return 'bg-green-50 border-green-200 text-green-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const renderOrganizationCard = (org: OrganizationWithStats, level: number = 0) => {
    const marginLeft = level * 20;
    
    return (
      <div key={org.id} style={{ marginLeft: `${marginLeft}px` }}>
        <div 
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
            selectedOrg?.id === org.id ? 'ring-2 ring-blue-500' : ''
          } ${getOrgColor(org.type)}`}
          onClick={() => setSelectedOrg(selectedOrg?.id === org.id ? null : org)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getOrgIcon(org.type)}
              <div>
                <h3 className="font-semibold text-lg">{org.name}</h3>
                {org.description && (
                  <p className="text-sm opacity-75">{org.description}</p>
                )}
                <span className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-50">
                  {org.type === 'SCHOOL' ? '学校' : '院系'}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>{org.stats.userCount} 用户</span>
              </div>
              <div className="flex items-center space-x-1">
                <Phone className="w-4 h-4" />
                <span>{org.stats.numberCount} 号码</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-4 h-4" />
                <span>{org.stats.availableNumbers} 可用</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{org.stats.pendingReview} 待审</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* 渲染子组织 */}
        {org.children.map(child => renderOrganizationCard(child, level + 1))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">加载组织数据中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">错误: {error}</p>
          <button 
            onClick={fetchOrganizationHierarchy}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">多租户管理仪表板</h2>
        <p className="text-gray-600">查看和管理组织层级结构及统计信息</p>
      </div>

      {organizations.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">暂无组织数据</p>
        </div>
      ) : (
        <div className="space-y-4">
          {organizations.map(org => renderOrganizationCard(org))}
        </div>
      )}

      {/* 选中组织的详细信息 */}
      {selectedOrg && (
        <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-xl font-semibold mb-4">组织详情: {selectedOrg.name}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-blue-600">用户数量</span>
              </div>
              <p className="text-2xl font-bold text-blue-800">{selectedOrg.stats.userCount}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Phone className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-600">总号码数</span>
              </div>
              <p className="text-2xl font-bold text-green-800">{selectedOrg.stats.numberCount}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-yellow-600" />
                <span className="text-sm text-yellow-600">可用号码</span>
              </div>
              <p className="text-2xl font-bold text-yellow-800">{selectedOrg.stats.availableNumbers}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-red-600" />
                <span className="text-sm text-red-600">待审核</span>
              </div>
              <p className="text-2xl font-bold text-red-800">{selectedOrg.stats.pendingReview}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiTenantDashboard;