"use client";

import React, { useState } from 'react';
import { Organization } from '@prisma/client';
import { ENUM_TRANSLATIONS } from '@/lib/utils';

interface UserOrganization {
  id: string;
  role: string;
  organization: Organization & {
    parent?: Organization | null;
    children?: Organization[];
  };
}

interface OrganizationHierarchyProps {
  userOrganizations: UserOrganization[];
  compact?: boolean;
  showRoles?: boolean;
}

// 定义扩展的用户组织类型，包含 children 属性
type UserOrganizationWithChildren = UserOrganization & { children: UserOrganizationWithChildren[] };

export const OrganizationHierarchy: React.FC<OrganizationHierarchyProps> = ({ 
  userOrganizations, 
  compact = false, 
  showRoles = true 
}) => {
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  const toggleExpanded = (orgId: string) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedOrgs(newExpanded);
  };

  const getOrgTypeIcon = (type: string) => {
    switch (type) {
      case 'SCHOOL':
        return '🏫';
      case 'DEPARTMENT':
        return '🏛️';
      case 'UNASSIGNED':
        return '📋';
      default:
        return '🏢';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'SCHOOL_ADMIN':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'MARKETER':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (userOrganizations.length === 0) {
    return (
      <div className="flex items-center text-gray-400 text-sm">
        <span className="mr-1">📋</span>
        <span>未分配组织</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-1">
        {userOrganizations.map((userOrg) => (
          <div key={userOrg.id} className="flex items-center space-x-2">
            <span className="text-xs">{getOrgTypeIcon(userOrg.organization.type)}</span>
            <span className="text-sm truncate max-w-32" title={userOrg.organization.name}>
              {userOrg.organization.name}
            </span>
            {showRoles && (
              <span className={`inline-flex px-1 py-0.5 text-xs font-medium rounded border ${
                getRoleColor(userOrg.role)
              }`}>
                {ENUM_TRANSLATIONS.Role[userOrg.role] || userOrg.role}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // 构建层级结构
  const buildHierarchy = (): UserOrganizationWithChildren[] => {
    const orgMap = new Map<string, UserOrganizationWithChildren>();
    const roots: UserOrganizationWithChildren[] = [];

    // 初始化所有组织
    userOrganizations.forEach(userOrg => {
      orgMap.set(userOrg.organization.id, { ...userOrg, children: [] });
    });

    // 构建层级关系
    userOrganizations.forEach(userOrg => {
      const org = orgMap.get(userOrg.organization.id)!;
      if (userOrg.organization.parentId) {
        const parent = orgMap.get(userOrg.organization.parentId);
        if (parent) {
          parent.children.push(org);
        } else {
          roots.push(org);
        }
      } else {
        roots.push(org);
      }
    });

    return roots;
  };

  const renderOrgNode = (userOrg: UserOrganizationWithChildren, level = 0): React.ReactElement => {
    const hasChildren = userOrg.children.length > 0;
    const isExpanded = expandedOrgs.has(userOrg.organization.id);
    const indent = level * 20;

    return (
      <div key={userOrg.organization.id} className="">
        <div 
          className="flex items-center space-x-2 py-1 hover:bg-gray-50 rounded"
          style={{ paddingLeft: `${indent}px` }}
        >
          {hasChildren && (
            <button
              onClick={() => toggleExpanded(userOrg.organization.id)}
              className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <div className="w-4" />}
          
          <span className="text-sm">{getOrgTypeIcon(userOrg.organization.type)}</span>
          
          <div className="flex-1 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              {userOrg.organization.name}
            </span>
            {showRoles && (
              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${
                getRoleColor(userOrg.role)
              }`}>
                {ENUM_TRANSLATIONS.Role[userOrg.role] || userOrg.role}
              </span>
            )}
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="">
            {userOrg.children.map(child => renderOrgNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const hierarchy = buildHierarchy();

  return (
    <div className="space-y-1">
      {hierarchy.map(rootOrg => renderOrgNode(rootOrg))}
    </div>
  );
};