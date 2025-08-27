import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Role, OrgType } from '@prisma/client';
import { NextRequest } from 'next/server';

// 权限检查结果接口
export interface PermissionResult {
  hasPermission: boolean;
  user?: {
    id: string;
    role: Role;
    organizations: Array<{
      id: string;
      name: string;
      type: OrgType;
      parentId?: string;
    }>;
  };
  error?: string;
}

// 数据过滤条件接口
export interface DataFilter {
  schoolIds?: string[];
  departmentIds?: string[];
  organizationIds?: string[];
  validationWarning?: string;
}

/**
 * 获取用户权限信息
 */
export async function getUserPermissions(): Promise<PermissionResult> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        hasPermission: false,
        error: '用户未登录'
      };
    }

    // 获取用户详细信息和组织关系
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        organizations: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!user) {
      return {
        hasPermission: false,
        error: '用户不存在'
      };
    }

    return {
      hasPermission: true,
      user: {
        id: user.id,
        role: user.role,
        organizations: user.organizations.map(uo => ({
          id: uo.organization.id,
          name: uo.organization.name,
          type: uo.organization.type,
          parentId: uo.organization.parentId || undefined
        }))
      }
    };
  } catch (error) {
    console.error('获取用户权限失败:', error);
    return {
      hasPermission: false,
      error: '权限检查失败'
    };
  }
}

/**
 * 检查用户是否有访问特定资源的权限
 */
export async function checkResourcePermission(
  resourceType: 'phone_number' | 'organization' | 'user',
  resourceId?: string,
  action: 'read' | 'write' | 'delete' = 'read'
): Promise<PermissionResult> {
  const userPermission = await getUserPermissions();
  
  if (!userPermission.hasPermission || !userPermission.user) {
    return userPermission;
  }

  const { user } = userPermission;

  // 超级管理员拥有所有权限
  if (user.role === 'SUPER_ADMIN') {
    return { hasPermission: true, user };
  }

  // 根据资源类型和用户角色检查权限
  switch (resourceType) {
    case 'phone_number':
      return await checkPhoneNumberPermission(user, resourceId, action);
    case 'organization':
      return await checkOrganizationPermission(user, resourceId, action);
    case 'user':
      return await checkUserPermission(user, resourceId, action);
    default:
      return {
        hasPermission: false,
        error: '未知的资源类型'
      };
  }
}

/**
 * 检查号码访问权限
 */
async function checkPhoneNumberPermission(
  user: NonNullable<PermissionResult['user']>,
  phoneNumberId?: string,
  action: 'read' | 'write' | 'delete' = 'read'
): Promise<PermissionResult> {
  // 超级管理员拥有所有权限
  if (user.role === 'SUPER_ADMIN') {
    return { hasPermission: true, user };
  }

  try {
    // 如果没有指定具体号码ID，检查是否有访问号码数据的基本权限
    if (!phoneNumberId) {
      return {
        hasPermission: user.organizations.length > 0,
        user,
        error: user.organizations.length === 0 ? '用户未分配到任何组织' : undefined
      };
    }

    // 获取号码详细信息
    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { id: phoneNumberId },
      include: {
        school: true,
        department: true
      }
    });

    if (!phoneNumber) {
      return {
        hasPermission: false,
        error: '号码不存在'
      };
    }

    // 检查用户是否有权限访问该号码所属的组织
    const userOrgIds = user.organizations.map(org => org.id);
    const hasSchoolAccess = phoneNumber.schoolId && userOrgIds.includes(phoneNumber.schoolId);
    const hasDepartmentAccess = phoneNumber.departmentId && userOrgIds.includes(phoneNumber.departmentId);

    return {
      hasPermission: Boolean(hasSchoolAccess || hasDepartmentAccess),
      user,
      error: !(hasSchoolAccess || hasDepartmentAccess) ? '无权限访问该号码' : undefined
    };
  } catch (error) {
    console.error('检查号码权限失败:', error);
    return {
      hasPermission: false,
      error: '权限检查失败'
    };
  }
}

/**
 * 检查组织访问权限
 */
async function checkOrganizationPermission(
  user: NonNullable<PermissionResult['user']>,
  organizationId?: string,
  action: 'read' | 'write' | 'delete' = 'read'
): Promise<PermissionResult> {
  if (!organizationId) {
    return {
      hasPermission: user.organizations.length > 0,
      user
    };
  }

  const userOrgIds = user.organizations.map(org => org.id);
  const hasAccess = userOrgIds.includes(organizationId);

  // 校级管理员可以访问其学校下的所有院系
  if (!hasAccess && user.role === 'SCHOOL_ADMIN') {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId }
      });
      
      if (organization?.parentId && userOrgIds.includes(organization.parentId)) {
        return { hasPermission: true, user };
      }
    } catch (error) {
      console.error('检查组织层级权限失败:', error);
    }
  }

  return {
    hasPermission: hasAccess,
    user,
    error: !hasAccess ? '无权限访问该组织' : undefined
  };
}

/**
 * 检查用户管理权限
 */
async function checkUserPermission(
  user: NonNullable<PermissionResult['user']>,
  targetUserId?: string,
  action: 'read' | 'write' | 'delete' = 'read'
): Promise<PermissionResult> {
  // 只有超级管理员和校级管理员可以管理用户
  if (user.role === 'MARKETER') {
    return {
      hasPermission: false,
      error: '销售人员无权限管理用户'
    };
  }

  // 校级管理员只能管理同组织的用户
  if (user.role === 'SCHOOL_ADMIN' && targetUserId) {
    try {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        include: {
          organizations: {
            include: {
              organization: true
            }
          }
        }
      });

      if (!targetUser) {
        return {
          hasPermission: false,
          error: '目标用户不存在'
        };
      }

      const userOrgIds = user.organizations.map(org => org.id);
      const targetUserOrgIds = targetUser.organizations.map(uo => uo.organization.id);
      const hasCommonOrg = userOrgIds.some(id => targetUserOrgIds.includes(id));

      return {
        hasPermission: hasCommonOrg,
        user,
        error: !hasCommonOrg ? '无权限管理该用户' : undefined
      };
    } catch (error) {
      console.error('检查用户管理权限失败:', error);
      return {
        hasPermission: false,
        error: '权限检查失败'
      };
    }
  }

  return { hasPermission: true, user };
}

/**
 * 获取用户数据过滤条件
 */
export async function getUserDataFilter(): Promise<DataFilter | null> {
  const userPermission = await getUserPermissions();
  
  if (!userPermission.hasPermission || !userPermission.user) {
    return null;
  }

  const { user } = userPermission;

  // 超级管理员不需要过滤
  if (user.role === 'SUPER_ADMIN') {
    return {};
  }

  const schoolIds: string[] = [];
  const departmentIds: string[] = [];
  const organizationIds = user.organizations.map(org => org.id);

  // 验证用户组织分配的合理性
  const validation = await validateUserOrganizations(user.id, organizationIds);
  if (!validation.isValid && user.role === 'MARKETER') {
    console.warn(`用户 ${user.id} 的组织分配不合理:`, validation.error);
    console.warn('缺失的学校权限:', validation.missingSchools);
  }

  // 分类组织ID
  for (const org of user.organizations) {
    if (org.type === 'SCHOOL') {
      schoolIds.push(org.id);
    } else if (org.type === 'DEPARTMENT') {
      departmentIds.push(org.id);
    }
  }

  // 校级管理员需要包含其学校下的所有院系
  if (user.role === 'SCHOOL_ADMIN' && schoolIds.length > 0) {
    try {
      const departments = await prisma.organization.findMany({
        where: {
          type: 'DEPARTMENT',
          parentId: { in: schoolIds }
        },
        select: { id: true }
      });
      
      departments.forEach(dept => {
        if (!departmentIds.includes(dept.id)) {
          departmentIds.push(dept.id);
        }
      });
    } catch (error) {
      console.error('获取院系列表失败:', error);
    }
  }

  return {
    schoolIds: schoolIds.length > 0 ? schoolIds : undefined,
    departmentIds: departmentIds.length > 0 ? departmentIds : undefined,
    organizationIds,
    validationWarning: !validation.isValid ? validation.error : undefined
  };
}

/**
 * API路由权限中间件 - 修复版本
 */
export function withAuth<T = any>(
  handler: (req: NextRequest, context: { params: T }) => Promise<Response>,
  options: {
    requiredRole?: Role[];
    resourceType?: 'phone_number' | 'organization' | 'user';
    action?: 'read' | 'write' | 'delete';
  } = {}
) {
  return async function(req: NextRequest, context: { params: T }): Promise<Response> {
    try {
      const userPermission = await getUserPermissions();
      
      if (!userPermission.hasPermission) {
        return new Response(
          JSON.stringify({ error: userPermission.error || '权限不足' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 检查角色权限
      if (options.requiredRole && userPermission.user) {
        if (!options.requiredRole.includes(userPermission.user.role)) {
          return new Response(
            JSON.stringify({ error: '角色权限不足' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // 检查资源权限
      if (options.resourceType) {
        const resourcePermission = await checkResourcePermission(
          options.resourceType,
          undefined,
          options.action
        );
        
        if (!resourcePermission.hasPermission) {
          return new Response(
            JSON.stringify({ error: resourcePermission.error || '资源访问权限不足' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // 调用原始处理函数
      return await handler(req, context);
    } catch (error) {
      console.error('权限中间件错误:', error);
      return new Response(
        JSON.stringify({ error: '服务器内部错误' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

/**
 * 检查管理员权限的辅助函数 - 修复版本
 */
export async function checkAdminPermission(): Promise<boolean> {
  const userPermission = await getUserPermissions();
  return userPermission.hasPermission && 
         userPermission.user?.role !== 'MARKETER' &&
         ['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(userPermission.user?.role || '');
}

/**
 * 验证用户组织分配的合理性
 * 确保院系销售员必须同时拥有对应学校的权限
 */
export async function validateUserOrganizations(
  userId: string,
  organizationIds: string[]
): Promise<{ isValid: boolean; error?: string; missingSchools?: string[] }> {
  try {
    // 获取所有相关组织信息
    const organizations = await prisma.organization.findMany({
      where: {
        id: { in: organizationIds }
      },
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        parent: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    const schools = organizations.filter(org => org.type === 'SCHOOL');
    const departments = organizations.filter(org => org.type === 'DEPARTMENT');
    const schoolIds = schools.map(school => school.id);
    const missingSchools: string[] = [];

    // 检查每个院系是否有对应的学校权限
    for (const dept of departments) {
      if (dept.parentId && !schoolIds.includes(dept.parentId)) {
        // 查找缺失的学校信息
        const parentSchool = await prisma.organization.findUnique({
          where: { id: dept.parentId },
          select: { name: true }
        });
        
        if (parentSchool) {
          missingSchools.push(`${dept.name} 需要对应的学校权限: ${parentSchool.name}`);
        }
      }
    }

    return {
      isValid: missingSchools.length === 0,
      error: missingSchools.length > 0 ? '院系权限缺少对应的学校权限' : undefined,
      missingSchools
    };
  } catch (error) {
    console.error('验证用户组织分配失败:', error);
    return {
      isValid: false,
      error: '验证失败'
    };
  }
}

/**
 * 验证并修正用户组织分配
 * 自动添加缺失的学校权限
 */
export async function validateAndFixUserOrganizations(
  userId: string,
  organizationIds: string[]
): Promise<{ success: boolean; finalOrganizationIds: string[]; addedSchools?: string[] }> {
  try {
    const validation = await validateUserOrganizations(userId, organizationIds);
    
    if (validation.isValid) {
      return {
        success: true,
        finalOrganizationIds: organizationIds
      };
    }

    // 获取需要添加的学校ID
    const departments = await prisma.organization.findMany({
      where: {
        id: { in: organizationIds },
        type: 'DEPARTMENT'
      },
      select: {
        parentId: true,
        parent: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const schoolsToAdd = departments
      .filter(dept => dept.parentId && !organizationIds.includes(dept.parentId))
      .map(dept => dept.parentId!)
      .filter((id, index, arr) => arr.indexOf(id) === index); // 去重

    const addedSchoolNames = departments
      .filter(dept => dept.parentId && schoolsToAdd.includes(dept.parentId))
      .map(dept => dept.parent?.name)
      .filter((name, index, arr) => arr.indexOf(name) === index); // 去重

    const finalOrganizationIds = [...organizationIds, ...schoolsToAdd];

    return {
      success: true,
      finalOrganizationIds,
      addedSchools: addedSchoolNames.filter(Boolean) as string[]
    };
  } catch (error) {
    console.error('修正用户组织分配失败:', error);
    return {
      success: false,
      finalOrganizationIds: organizationIds
    };
  }
}

/**
 * 更新的getUserDataFilter函数，增强院系-学校关联验证
 */
export async function getUserDataFilterEnhanced(): Promise<DataFilter | null> {
  const userPermission = await getUserPermissions();
  
  if (!userPermission.hasPermission || !userPermission.user) {
    return null;
  }

  const { user } = userPermission;

  // 超级管理员不需要过滤
  if (user.role === 'SUPER_ADMIN') {
    return {};
  }

  const schoolIds: string[] = [];
  const departmentIds: string[] = [];
  const organizationIds = user.organizations.map(org => org.id);

  // 验证用户组织分配的合理性
  const validation = await validateUserOrganizations(user.id, organizationIds);
  if (!validation.isValid && user.role === 'MARKETER') {
    console.warn(`用户 ${user.id} 的组织分配不合理:`, validation.error);
    console.warn('缺失的学校权限:', validation.missingSchools);
  }

  // 分类组织ID
  for (const org of user.organizations) {
    if (org.type === 'SCHOOL') {
      schoolIds.push(org.id);
    } else if (org.type === 'DEPARTMENT') {
      departmentIds.push(org.id);
    }
  }

  // 校级管理员需要包含其学校下的所有院系
  if (user.role === 'SCHOOL_ADMIN' && schoolIds.length > 0) {
    try {
      const departments = await prisma.organization.findMany({
        where: {
          type: 'DEPARTMENT',
          parentId: { in: schoolIds }
        },
        select: { id: true }
      });
      
      departments.forEach(dept => {
        if (!departmentIds.includes(dept.id)) {
          departmentIds.push(dept.id);
        }
      });
    } catch (error) {
      console.error('获取院系列表失败:', error);
    }
  }

  return {
    schoolIds: schoolIds.length > 0 ? schoolIds : undefined,
    departmentIds: departmentIds.length > 0 ? departmentIds : undefined,
    organizationIds,
    validationWarning: !validation.isValid ? validation.error : undefined
  };
}