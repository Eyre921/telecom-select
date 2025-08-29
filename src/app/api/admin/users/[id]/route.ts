import { NextRequest, NextResponse } from 'next/server';
import { getUserPermissions, getUserDataFilter } from '@/lib/permissions';
import prisma from '@/lib/prisma';
import { Role } from '@prisma/client';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt'; // 添加bcrypt导入

// GET /api/admin/users/[id] - 获取单个用户详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // 修改类型
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

  const { id } = await params;  // 添加 await

  if (!id) {
    return new NextResponse('用户ID不能为空', { status: 400 });
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: {
        organizations: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!targetUser) {
      return new NextResponse('用户不存在', { status: 404 });
    }

    // 权限检查：确保用户只能查看其管理范围内的用户
    const dataFilter = await getUserDataFilter();
    if (dataFilter?.organizationIds) {
      const userOrgIds = targetUser.organizations.map(uo => uo.organizationId);
      const hasPermission = userOrgIds.some(orgId => dataFilter.organizationIds!.includes(orgId));
      
      if (!hasPermission) {
        return new NextResponse('无权限查看该用户', { status: 403 });
      }
    }

    return NextResponse.json(targetUser);
  } catch (error) {
    console.error('获取用户详情失败:', error);
    return new NextResponse('服务器错误', { status: 500 });
  }
}

// PATCH /api/admin/users/[id] - 更新用户信息
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params;  // 这里已经正确使用了 await

  if (!id) {
    return new NextResponse('用户ID不能为空', { status: 400 });
  }

  try {
    const body = await request.json();
    const { name, username, email, phone, password } = body;

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        organizations: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!existingUser) {
      return new NextResponse('用户不存在', { status: 404 });
    }

    // 权限检查：确保用户只能修改其管理范围内的用户
    const dataFilter = await getUserDataFilter();
    if (dataFilter?.organizationIds) {
      const userOrgIds = existingUser.organizations.map(uo => uo.organizationId);
      const hasPermission = userOrgIds.some(orgId => dataFilter.organizationIds!.includes(orgId));
      
      if (!hasPermission) {
        return new NextResponse('无权限修改该用户', { status: 403 });
      }
    }

    // 构建更新数据
    const updateData: Prisma.UserUpdateInput = {};
    
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: '姓名不能为空' }, { status: 400 });
      }
      updateData.name = name.trim();
    }
    
    // 添加用户名处理
    if (username !== undefined && username.trim()) {
      // 检查用户名是否已被其他用户使用
      const usernameExists = await prisma.user.findFirst({
        where: {
          username: username.trim(),
          id: { not: id }
        }
      });
      
      if (usernameExists) {
        return NextResponse.json({ error: '该用户名已被使用' }, { status: 409 });
      }
      
      updateData.username = username.trim();
    }
    
    // 添加手机号处理
    if (phone !== undefined) {
      if (!phone.trim()) {
        return NextResponse.json({ error: '手机号不能为空' }, { status: 400 });
      }
      
      // 手机号格式验证
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone.trim())) {
        return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 });
      }
      
      // 检查手机号是否已被其他用户使用
      const phoneExists = await prisma.user.findFirst({
        where: {
          phone: phone.trim(),
          id: { not: id }
        }
      });
      
      if (phoneExists) {
        return NextResponse.json({ error: '该手机号已被使用' }, { status: 409 });
      }
      
      updateData.phone = phone.trim();
    }
    
    if (email !== undefined && email.trim()) {
      // 邮箱格式验证
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
      }
      
      // 检查邮箱是否已被其他用户使用
      const emailExists = await prisma.user.findFirst({
        where: {
          email: email.trim(),
          id: { not: id }
        }
      });
      
      if (emailExists) {
        return NextResponse.json({ error: '该邮箱已被使用' }, { status: 409 });
      }
      
      updateData.email = email.trim();
    }
    
    // 添加密码处理
    if (password !== undefined && password.trim()) {
      if (password.length < 6) {
        return NextResponse.json({ error: '密码长度至少为6位' }, { status: 400 });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    // 如果没有要更新的数据
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existingUser);
    }

    // 更新用户
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        organizations: {
          include: {
            organization: true
          }
        }
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('更新用户失败:', error);
    return new NextResponse('服务器错误', { status: 500 });
  }
}

// DELETE /api/admin/users/[id] - 删除用户
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // 修改类型
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

  const { id } = await params;  // 添加 await

  if (!id) {
    return new NextResponse('用户ID不能为空', { status: 400 });
  }

  try {
    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        organizations: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!existingUser) {
      return new NextResponse('用户不存在', { status: 404 });
    }

    // 权限检查：确保用户只能删除其管理范围内的用户
    const dataFilter = await getUserDataFilter();
    if (dataFilter?.organizationIds) {
      const userOrgIds = existingUser.organizations.map(uo => uo.organizationId);
      const hasPermission = userOrgIds.some(orgId => dataFilter.organizationIds!.includes(orgId));
      
      if (!hasPermission) {
        return new NextResponse('无权限删除该用户', { status: 403 });
      }
    }

    // 防止删除自己
    if (existingUser.id === user.id) {
      return new NextResponse('不能删除自己的账户', { status: 400 });
    }

    // 删除用户（级联删除相关记录）
    await prisma.user.delete({
      where: { id }
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('删除用户失败:', error);
    return new NextResponse('服务器错误', { status: 500 });
  }
}