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
    return NextResponse.json({ error: '权限不足' }, { status: 401 });
  }

  const user = userPermission.user!;
  
  // 检查读取权限
  if (user.role === 'MARKETER') {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
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
    // 对于非超级管理员，只能看到同级或下级用户
    if (user.role !== 'SUPER_ADMIN') {
      where.AND = [
        // 排除超级管理员
        { role: { not: Role.SUPER_ADMIN } },
        // 只能看到有组织关系且在允许的组织内的用户
        {
          organizations: {
            some: {
              organizationId: {
                in: dataFilter.organizationIds
              }
            }
          }
        }
      ];
    }
    // 超级管理员不需要任何过滤，可以看到所有用户（包括其他超级管理员）
  } else if (user.role !== 'SUPER_ADMIN') {
    // 如果没有组织权限且不是超级管理员，返回空结果
    where.id = 'impossible-id';
  }

  // 搜索条件
  if (search) {
    const searchCondition = {
      OR: [
        { name: { contains: search } },
        { email: { contains: search } },
        { username: { contains: search } },
        { phone: { contains: search } }
      ]
    };
    
    if (where.OR) {
      // 如果已有OR条件，需要组合
      where.AND = [
        { OR: where.OR },
        searchCondition
      ];
      delete where.OR;
    } else {
      where.OR = searchCondition.OR;
    }
  }

  // 角色过滤
  if (role && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'MARKETER'].includes(role)) {
    if (role === 'SUPER_ADMIN') {
      // 筛选超级管理员：直接按用户表的role字段筛选
      where.role = role as Role; // 修复：添加类型断言
    } else {
      // 筛选其他角色：按组织关系中的role筛选
      const roleCondition = {
        organizations: {
          some: {
            role: role as Role
          }
        }
      };
      
      if (where.AND) {
        // 修复：确保AND是数组类型
        if (Array.isArray(where.AND)) {
          where.AND.push(roleCondition);
        } else {
          where.AND = [where.AND, roleCondition];
        }
      } else if (where.OR) {
        where.AND = [{ OR: where.OR }, roleCondition];
        delete where.OR;
      } else {
        Object.assign(where, roleCondition);
      }
    }
  }

  // 组织过滤 - 添加权限检查
  if (organizationId) {
    // 检查当前用户是否有权限访问指定的组织
    const dataFilter = await getUserDataFilter();
    if (dataFilter?.organizationIds && !dataFilter.organizationIds.includes(organizationId)) {
      return NextResponse.json({ error: '无权限访问该组织的用户数据' }, { status: 403 });
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
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 在文件顶部添加生成随机用户名的函数
function generateRandomUsername(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `user_${timestamp}_${randomStr}`;
}

// 简化 ensureUniqueUsername 函数，只用于自动生成
async function ensureUniqueUsername(): Promise<string> {
  let username = generateRandomUsername();
  
  // 检查用户名是否已存在
  let existingUser = await prisma.user.findUnique({
    where: { username }
  });
  
  // 如果用户名已存在，生成新的随机用户名
  while (existingUser) {
    username = generateRandomUsername();
    existingUser = await prisma.user.findUnique({
      where: { username }
    });
  }
  
  return username;
}

// POST /api/admin/users - 创建新用户
export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json();
    // 修改用户名唯一性检查逻辑
    const { username, name, phone, email, password, role, organizationId, organizationRole } = body;
    
    // 基础验证 - 只要求姓名、手机号、密码为必填
    if (!name || !phone || !password) {
      return NextResponse.json({ error: '姓名、手机号和密码为必填项' }, { status: 400 });
    }
    
    // 用户名处理逻辑
    let finalUsername: string;
    if (username) {
      // 如果明确提供了用户名，检查是否已存在
      const existingUser = await prisma.user.findUnique({
        where: { username }
      });
      
      if (existingUser) {
        return NextResponse.json({ error: '该用户名已被使用' }, { status: 409 });
      }
      
      finalUsername = username;
    } else {
      // 如果没有提供用户名，自动生成唯一用户名
      finalUsername = await ensureUniqueUsername();
    }

    // 角色和组织关系验证
    if (!role || !['SUPER_ADMIN', 'SCHOOL_ADMIN', 'MARKETER'].includes(role)) {
      return NextResponse.json({ error: '必须指定有效的用户角色' }, { status: 400 });
    }

    // 防止手动选择超级管理员组
    if (organizationId === 'super-admin-org' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: '不能手动选择超级管理员组' }, { status: 400 });
    }

    // 超级管理员默认分配到超级管理员组
    let finalOrganizationId = organizationId;
    let finalOrganizationRole = organizationRole;
    
    if (role === 'SUPER_ADMIN') {
      finalOrganizationId = 'super-admin-org';
      finalOrganizationRole = 'SUPER_ADMIN';
    }

    // 非超级管理员必须分配到组织
    if (role !== 'SUPER_ADMIN' && !organizationId) {
      return NextResponse.json({ error: '非超级管理员必须分配到组织' }, { status: 400 });
    }

    // 组织内角色验证
    if (finalOrganizationId && role !== 'SUPER_ADMIN') {
      if (!finalOrganizationRole || !['SCHOOL_ADMIN', 'MARKETER'].includes(finalOrganizationRole)) {
        return NextResponse.json({ error: '组织内角色只能是学校管理员或营销人员' }, { status: 400 });
      }
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
      pattern.test(username) || pattern.test(name) || (email && pattern.test(email))
    );

    if (hasXSSPattern) {
      return NextResponse.json({ error: '输入内容包含不安全字符，请检查后重新输入' }, { status: 400 });
    }

    // 邮箱格式验证（如果提供了邮箱）
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
      }
    }

    // 手机号格式验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 });
    }

    // 检查邮箱是否已存在（如果提供了邮箱）
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email }
      });

      if (existingEmail) {
        return NextResponse.json({ error: '该邮箱已被使用' }, { status: 409 });
      }
    }

    // 检查手机号是否已存在
    const existingPhone = await prisma.user.findUnique({
      where: { phone }
    });

    if (existingPhone) {
      return NextResponse.json({ error: '该手机号已被使用' }, { status: 409 });
    }

    // 权限检查：确保用户只能在其管理的组织内创建用户
    const dataFilter = await getUserDataFilter();
    if (organizationId && dataFilter?.organizationIds && !dataFilter.organizationIds.includes(organizationId)) {
      return NextResponse.json({ error: '无权限在该组织创建用户' }, { status: 403 });
    }

    // 验证组织是否存在且为学校类型
    if (finalOrganizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: finalOrganizationId }
      });
      
      if (!organization) {
        return NextResponse.json({ error: '指定的组织不存在' }, { status: 400 });
      }
      
      if (organization.type !== 'SCHOOL') {
        return NextResponse.json({ error: '只能将用户分配到学校类型的组织' }, { status: 400 });
      }
    }

    // 密码哈希处理
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    // 创建用户时使用 finalUsername
    const newUser = await prisma.user.create({
      data: {
        username: finalUsername,
        name,
        phone,
        email: email || null,
        password: hashedPassword,
        role: role as Role,
        organizations: {
          create: {
            organizationId: finalOrganizationId,
            role: finalOrganizationRole as Role
          }
        }
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
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
