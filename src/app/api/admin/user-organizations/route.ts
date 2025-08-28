import { NextRequest, NextResponse } from 'next/server';
import { getUserPermissions, getUserDataFilter, validateAndFixUserOrganizations } from '@/lib/permissions';
import prisma from '@/lib/prisma';
import { Role, Prisma } from '@prisma/client';

// 定义查询条件类型
type UserOrganizationWhereInput = {
  userId?: string;
  organizationId?: string | { in: string[] };
};

// 定义响应类型
type PostResponseType = {
  success: boolean;
  userOrganizations: Prisma.UserOrganizationGetPayload<{
    include: {
      user: {
        select: {
          id: true;
          name: true;
          email: true;
          role: true;
        }
      };
      organization: {
        select: {
          id: true;
          name: true;
          type: true;
        }
      };
    }
  }>[];
  message: string;
  autoAddedSchools?: string[];
};

// GET /api/admin/user-organizations - 获取用户组织关系列表
export async function GET(request: NextRequest) {
  // 权限检查
  const userPermission = await getUserPermissions();
  if (!userPermission.hasPermission) {
    return new NextResponse('权限不足', { status: 401 });
  }

  const user = userPermission.user!;
  
  // 检查读取权限
  if (user.role === 'MARKETER') {
    return new NextResponse('权限不足', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const organizationId = searchParams.get('organizationId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const skip = (page - 1) * limit;

  try {
    // 构建查询条件
    const where: UserOrganizationWhereInput = {};
    
    if (userId) {
      where.userId = userId;
    }
    
    if (organizationId) {
      where.organizationId = organizationId;
    }

    // 应用多租户数据过滤
    const dataFilter = await getUserDataFilter();
    if (dataFilter?.organizationIds) {
      where.organizationId = {
        in: dataFilter.organizationIds
      };
    }

    const [userOrganizations, total] = await Promise.all([
      prisma.userOrganization.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          organization: {
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
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.userOrganization.count({ where })
    ]);

    return NextResponse.json({
      userOrganizations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取用户组织关系失败:', error);
    return new NextResponse('服务器错误', { status: 500 });
  }
}

// POST /api/admin/user-organizations - 分配用户到组织
export async function POST(request: NextRequest) {
  // 权限检查
  const userPermission = await getUserPermissions();
  if (!userPermission.hasPermission) {
    return new NextResponse('权限不足', { status: 401 });
  }

  const user = userPermission.user!;
  
  // 检查写入权限
  if (user.role === 'MARKETER') {
    return new NextResponse('权限不足', { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, organizationIds, role } = body;

    // 参数验证
    if (!userId || !organizationIds || !Array.isArray(organizationIds) || organizationIds.length === 0) {
      return new NextResponse('参数不完整', { status: 400 });
    }

    if (!role || !['SCHOOL_ADMIN', 'MARKETER'].includes(role)) {
      return new NextResponse('组织内角色只能是学校管理员或营销人员', { status: 400 });
    }

    // 1. 首先验证组织是否存在和类型是否正确
    for (const orgId of organizationIds) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { type: true }
      });
      
      if (!org) {
        return NextResponse.json(
          { error: `组织 ${orgId} 不存在` },
          { status: 404 }  // ✅ 修复：资源不存在应该返回 404
        );
      }
      
      if (org.type !== 'SCHOOL') {
        return NextResponse.json(
          { error: `只能分配到学校级别的组织` },
          { status: 400 }
        );
      }
    }

    // 2. 然后检查权限：确保只能在管理范围内分配
    const dataFilter = await getUserDataFilter();
    if (dataFilter?.organizationIds) {
      const hasPermission = organizationIds.every(orgId => 
        dataFilter.organizationIds!.includes(orgId)
      );
      
      if (!hasPermission) {
        return new NextResponse('无权限在某些组织中分配用户', { status: 403 });
      }
    }

    // 3. 最后检查用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return new NextResponse('用户不存在', { status: 404 });
    }

    // 验证并修正组织分配（自动添加缺失的学校权限）
    const validation = await validateAndFixUserOrganizations(userId, organizationIds);
    
    if (!validation.success) {
      return new NextResponse('组织分配验证失败', { status: 400 });
    }

    // 批量创建用户组织关系
    const userOrganizations = [];
    // 在分配组织关系之前，先验证组织是否存在
    for (const orgId of validation.finalOrganizationIds) {
      const orgExists = await prisma.organization.findUnique({
        where: { id: orgId }
      });
      
      if (!orgExists) {
        return NextResponse.json(
          { error: `组织 ${orgId} 不存在` },
          { status: 400 }
        );
      }
    }
    for (const orgId of validation.finalOrganizationIds) {
      const userOrg = await prisma.userOrganization.upsert({
        where: {
          userId_organizationId: {
            userId,
            organizationId: orgId
          }
        },
        update: {
          role: role as Role
        },
        create: {
          userId,
          organizationId: orgId,
          role: role as Role
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          organization: {
            select: {
              id: true,
              name: true,
              type: true
            }
          }
        }
      });
      userOrganizations.push(userOrg);
    }

    const response: PostResponseType = {
      success: true,
      userOrganizations,
      message: '用户组织关系分配成功'
    };

    // 如果自动添加了学校权限，在响应中说明
    if (validation.addedSchools && validation.addedSchools.length > 0) {
      response.autoAddedSchools = validation.addedSchools;
      response.message += `，自动添加了学校权限: ${validation.addedSchools.join(', ')}`;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('分配用户组织关系失败:', error);
    return new NextResponse('服务器错误', { status: 500 });
  }
}

// DELETE /api/admin/user-organizations - 移除用户组织关联
export async function DELETE(request: NextRequest) {
  // 权限检查
  const userPermission = await getUserPermissions();
  if (!userPermission.hasPermission) {
    return new NextResponse('权限不足', { status: 401 });
  }

  const user = userPermission.user!;
  
  // 检查写入权限
  if (user.role === 'MARKETER') {
    return new NextResponse('权限不足', { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, organizationId } = body;

    // 参数验证
    if (!userId || !organizationId) {
      return new NextResponse('参数不完整', { status: 400 });
    }

    // 权限检查：确保只能在管理范围内操作
    const dataFilter = await getUserDataFilter();
    if (dataFilter?.organizationIds && !dataFilter.organizationIds.includes(organizationId)) {
      return new NextResponse('无权限操作该组织', { status: 403 });
    }

    // 检查关系是否存在
    const existingRelation = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId
        }
      }
    });

    if (!existingRelation) {
      return new NextResponse('用户组织关系不存在', { status: 404 });
    }

    // 删除关系
    await prisma.userOrganization.delete({
      where: {
        userId_organizationId: {
          userId,
          organizationId
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: '用户组织关系移除成功'
    });
  } catch (error) {
    console.error('移除用户组织关系失败:', error);
    return new NextResponse('服务器错误', { status: 500 });
  }
}