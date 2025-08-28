import { NextRequest, NextResponse } from 'next/server';
import { getUserPermissions, getUserDataFilter } from '@/lib/permissions';
import prisma from '@/lib/prisma';
import { Role } from '@prisma/client';

// GET /api/admin/user-organizations/[id] - 获取单个用户组织关系详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const { id } = params;

  if (!id) {
    return new NextResponse('关系ID不能为空', { status: 400 });
  }

  try {
    const userOrganization = await prisma.userOrganization.findUnique({
      where: { id },
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
      }
    });

    if (!userOrganization) {
      return new NextResponse('用户组织关系不存在', { status: 404 });
    }

    // 权限检查：确保只能查看管理范围内的关系
    const dataFilter = await getUserDataFilter();
    if (dataFilter?.organizationIds && !dataFilter.organizationIds.includes(userOrganization.organizationId)) {
      return new NextResponse('无权限查看该关系', { status: 403 });
    }

    return NextResponse.json(userOrganization);
  } catch (error) {
    console.error('获取用户组织关系详情失败:', error);
    return new NextResponse('服务器错误', { status: 500 });
  }
}

// PATCH /api/admin/user-organizations/[id] - 更新用户在组织中的角色
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const { id } = params;

  if (!id) {
    return new NextResponse('关系ID不能为空', { status: 400 });
  }

  try {
    const body = await request.json();
    const { role } = body;

    // 参数验证
    if (!role || !['SUPER_ADMIN', 'SCHOOL_ADMIN', 'MARKETER'].includes(role)) {
      return new NextResponse('角色参数无效', { status: 400 });
    }

    // 检查关系是否存在
    const existingRelation = await prisma.userOrganization.findUnique({
      where: { id }
    });

    if (!existingRelation) {
      return new NextResponse('用户组织关系不存在', { status: 404 });
    }

    // 权限检查：确保只能在管理范围内操作
    const dataFilter = await getUserDataFilter();
    if (dataFilter?.organizationIds && !dataFilter.organizationIds.includes(existingRelation.organizationId)) {
      return new NextResponse('无权限操作该关系', { status: 403 });
    }

    // 更新角色
    const updatedRelation = await prisma.userOrganization.update({
      where: { id },
      data: {
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
            type: true,
            parentId: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      userOrganization: updatedRelation,
      message: '用户角色更新成功'
    });
  } catch (error) {
    console.error('更新用户组织关系失败:', error);
    return new NextResponse('服务器错误', { status: 500 });
  }
}

// DELETE /api/admin/user-organizations/[id] - 删除单个用户组织关系
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const { id } = params;

  if (!id) {
    return new NextResponse('关系ID不能为空', { status: 400 });
  }

  try {
    // 检查关系是否存在
    const existingRelation = await prisma.userOrganization.findUnique({
      where: { id }
    });

    if (!existingRelation) {
      return new NextResponse('用户组织关系不存在', { status: 404 });
    }

    // 权限检查：确保只能在管理范围内操作
    const dataFilter = await getUserDataFilter();
    if (dataFilter?.organizationIds && !dataFilter.organizationIds.includes(existingRelation.organizationId)) {
      return new NextResponse('无权限操作该关系', { status: 403 });
    }

    // 删除关系
    await prisma.userOrganization.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: '用户组织关系删除成功'
    });
  } catch (error) {
    console.error('删除用户组织关系失败:', error);
    return new NextResponse('服务器错误', { status: 500 });
  }
}