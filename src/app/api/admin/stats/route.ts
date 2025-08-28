import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ReservationStatus, Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // 简化的权限检查
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 获取用户信息和组织关系
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
      return NextResponse.json({ error: '用户不存在' }, { status: 401 });
    }

    // 检查角色权限
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'MARKETER'].includes(user.role)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const departmentId = searchParams.get('departmentId');
    
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    // 构建查询条件
    const whereClause: Prisma.PhoneNumberWhereInput = {};
    
    // 应用URL参数筛选
    if (schoolId) {
      whereClause.schoolId = schoolId;
    }
    if (departmentId) {
      whereClause.departmentId = departmentId;
    }
    
    // 简化的权限过滤：只对非超级管理员应用组织过滤
    if (user.role !== 'SUPER_ADMIN') {
      const userOrgIds = user.organizations.map(uo => uo.organization.id);
      
      if (userOrgIds.length > 0) {
        // 如果已经有URL参数筛选，确保在用户权限范围内
        if (schoolId || departmentId) {
          const allowedFilters: Prisma.PhoneNumberWhereInput[] = [];
          
          if (schoolId && userOrgIds.includes(schoolId)) {
            allowedFilters.push({ schoolId });
          }
          if (departmentId && userOrgIds.includes(departmentId)) {
            allowedFilters.push({ departmentId });
          }
          
          if (allowedFilters.length === 0) {
            // 用户没有权限访问指定的组织
            return NextResponse.json({
              totalNumbers: 0,
              availableNumbers: 0,
              pendingReview: 0,
              newOrdersToday: 0,
            });
          }
        } else {
          // 没有URL参数，应用用户的组织过滤
          whereClause.OR = [
            { schoolId: { in: userOrgIds } },
            { departmentId: { in: userOrgIds } }
          ];
        }
      }
    }

    const [totalNumbers, availableNumbers, pendingReview, newOrdersToday] = await prisma.$transaction([
      prisma.phoneNumber.count({ where: whereClause }),
      prisma.phoneNumber.count({
        where: {
          ...whereClause,
          reservationStatus: ReservationStatus.UNRESERVED
        }
      }),
      prisma.phoneNumber.count({
        where: {
          ...whereClause,
          reservationStatus: ReservationStatus.PENDING_REVIEW
        }
      }),
      prisma.phoneNumber.count({
        where: {
          ...whereClause,
          orderTimestamp: {gte: startOfToday},
        },
      }),
    ]);

    return NextResponse.json({
      totalNumbers,
      availableNumbers,
      pendingReview,
      newOrdersToday,
    });
  } catch (error) {
    console.error('[ADMIN_STATS_API_ERROR]', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
