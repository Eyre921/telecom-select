import { NextRequest, NextResponse } from 'next/server';
import { getUserPermissions, getUserDataFilter } from '@/lib/permissions';
import prisma from '@/lib/prisma';
import { Role } from '@prisma/client';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

// GET /api/admin/users - 获取用户列表
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
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const role = searchParams.get('role') || '';
  const organizationId = searchParams.get('organizationId') || '';

  const skip = (page - 1) * limit;

  // 构建查询条件
  const where: Prisma.UserWhereInput = {};

  // 应用多租户数据过滤
  const dataFilter = await getUserDataFilter();
  if (dataFilter?.organizationIds) {
    where.organizations = {
      some: {
        organizationId: {
          in: dataFilter.organizationIds
        }
      }
    };
  }

  // 搜索条件
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } }
    ];
  }

  // 角色过滤
  if (role && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'MARKETER'].includes(role)) {
    where.organizations = {
      ...where.organizations,
      some: {
        ...where.organizations?.some,
        role: role as Role
      }
    };
  }

  // 组织过滤 - 添加权限检查
  if (organizationId) {
  // 检查当前用户是否有权限访问指定的组织
  const dataFilter = await getUserDataFilter();
  if (dataFilter?.organizationIds && !dataFilter.organizationIds.includes(organizationId)) {
    return new NextResponse('无权限访问该组织的用户数据', { status: 403 });
  }
  
  where.organizations = {
    ...where.organizations,
    some: {
      ...where.organizations?.some,
      organizationId: organizationId
    }
  };
}

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          organizations: {
            include: {
              organization: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return new NextResponse('服务器错误', { status: 500 });
  }
}

// POST /api/admin/users - 创建新用户
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
    const { username, name, phone, email, password, organizationId, role } = body;

    // 基础验证
    if (!username || !name || !phone || !email) {
      return new NextResponse('用户名、姓名、手机号和邮箱为必填项', { status: 400 });
    }

    // 用户名特殊字符验证
    const usernameRegex = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/;
    if (!usernameRegex.test(username)) {
      return new NextResponse('用户名只能包含字母、数字、下划线和中文字符', { status: 400 });
    }

    // 检查是否包含潜在的XSS攻击代码
    const dangerousPatterns = [
      /<script[^>]*>/i,
      /<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe[^>]*>/i,
      /<object[^>]*>/i,
      /<embed[^>]*>/i,
      /<link[^>]*>/i,
      /<meta[^>]*>/i
    ];

    const hasXSSPattern = dangerousPatterns.some(pattern => 
      pattern.test(username) || pattern.test(name) || pattern.test(email)
    );

    if (hasXSSPattern) {
      return new NextResponse('输入内容包含不安全字符，请检查后重新输入', { status: 400 });
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new NextResponse('邮箱格式不正确', { status: 400 });
    }

    // 手机号格式验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return new NextResponse('手机号格式不正确', { status: 400 });
    }

    // 角色验证
    if (role && !['SUPER_ADMIN', 'SCHOOL_ADMIN', 'MARKETER'].includes(role)) {
      return new NextResponse('无效的角色类型', { status: 400 });
    }

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUsername) {
      return new NextResponse('该用户名已被使用', { status: 409 });
    }

    // 检查邮箱是否已存在
    const existingEmail = await prisma.user.findUnique({
      where: { email }
    });

    if (existingEmail) {
      return new NextResponse('该邮箱已被使用', { status: 409 });
    }

    // 检查手机号是否已存在
    const existingPhone = await prisma.user.findUnique({
      where: { phone }
    });

    if (existingPhone) {
      return new NextResponse('该手机号已被使用', { status: 409 });
    }

    // 权限检查：确保用户只能在其管理的组织内创建用户
    const dataFilter = await getUserDataFilter();
    if (organizationId && dataFilter?.organizationIds && !dataFilter.organizationIds.includes(organizationId)) {
      return new NextResponse('无权限在该组织创建用户', { status: 403 });
    }

    // 密码哈希处理
    const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('123456', 10);

    // 创建用户
    const newUser = await prisma.user.create({
      data: {
        username,
        name,
        phone,
        email,
        password: hashedPassword,
        ...(organizationId && role && {
          organizations: {
            create: {
              organizationId,
              role: role as Role
            }
          }
        })
      },
      include: {
        organizations: {
          include: {
            organization: true
          }
        }
      }
    });

    // 返回时不包含密码
    const { password: _, ...userWithoutPassword } = newUser;
    return NextResponse.json({ user: userWithoutPassword }, { status: 201 });
  } catch (error) {
    console.error('创建用户失败:', error);
    return new NextResponse('服务器错误', { status: 500 });
  }
}
