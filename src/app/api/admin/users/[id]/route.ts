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
  try {
    // 权限检查
    const userPermission = await getUserPermissions();
    if (!userPermission.hasPermission) {
      return NextResponse.json({ error: '权限不足' }, { status: 401 });
    }

    const user = userPermission.user!;
    
    // 检查写入权限
    if (user.role === 'MARKETER') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 });
    }

    // 解析请求体
    const body = await request.json();
    const { name, username, email, phone, password } = body;

    // 验证必填字段
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: '姓名不能为空' }, { status: 400 });
    }

    if (!phone || phone.trim() === '') {
      return NextResponse.json({ error: '手机号不能为空' }, { status: 400 });
    }

    // 手机号格式验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 });
    }

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
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 权限检查：确保只能在管理范围内操作
    const dataFilter = await getUserDataFilter();
    if (dataFilter?.organizationIds) {
      const userOrgIds = existingUser.organizations.map(org => org.organizationId);
      const hasPermission = userOrgIds.some(orgId => dataFilter.organizationIds!.includes(orgId));
      if (!hasPermission) {
        return NextResponse.json({ error: '无权限操作该用户' }, { status: 403 });
      }
    }

    // 检查手机号是否已被其他用户使用
    if (phone !== existingUser.phone) {
      const phoneExists = await prisma.user.findFirst({
        where: {
          phone,
          id: { not: id }
        }
      });
      if (phoneExists) {
        return NextResponse.json({ error: '该手机号已被使用' }, { status: 400 });
      }
    }

    // 检查用户名是否已被其他用户使用
    if (username && username !== existingUser.username) {
      const usernameExists = await prisma.user.findFirst({
        where: {
          username,
          id: { not: id }
        }
      });
      if (usernameExists) {
        return NextResponse.json({ error: '该用户名已被使用' }, { status: 400 });
      }
    }

    // 检查邮箱是否已被其他用户使用
    if (email && email !== existingUser.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
      }
      
      const emailExists = await prisma.user.findFirst({
        where: {
          email,
          id: { not: id }
        }
      });
      if (emailExists) {
        return NextResponse.json({ error: '该邮箱已被使用' }, { status: 400 });
      }
    }

    // 准备更新数据
    const updateData: Prisma.UserUpdateInput = {
      name: name.trim(),
      phone: phone.trim(),
    };

    if (username) {
      updateData.username = username.trim();
    }

    if (email) {
      updateData.email = email.trim();
    }

    // 如果提供了密码，进行加密
    if (password && password.trim() !== '') {
      if (password.length < 6) {
        return NextResponse.json({ error: '密码长度至少为6位' }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    // 更新用户
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: '用户信息更新成功'
    });

  } catch (error) {
    console.error('更新用户失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] - 删除用户
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 权限检查
  const userPermission = await getUserPermissions();
  if (!userPermission.hasPermission) {
    return NextResponse.json({ error: '权限不足' }, { status: 401 });
  }

  const user = userPermission.user!;
  
  // 检查写入权限
  if (user.role === 'MARKETER') {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 });
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
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 权限检查：确保用户只能删除其管理范围内的用户
    const dataFilter = await getUserDataFilter();
    if (dataFilter?.organizationIds) {
      const userOrgIds = existingUser.organizations.map(uo => uo.organizationId);
      const hasPermission = userOrgIds.some(orgId => dataFilter.organizationIds!.includes(orgId));
      
      if (!hasPermission) {
        return NextResponse.json({ error: '无权限删除该用户' }, { status: 403 });
      }
    }

    // 防止删除自己
    if (existingUser.id === user.id) {
      return NextResponse.json({ error: '不能删除自己的账户' }, { status: 400 });
    }

    // 删除用户（级联删除相关记录）
    await prisma.user.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: '用户删除成功' }, { status: 200 });
  } catch (error) {
    console.error('删除用户失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}