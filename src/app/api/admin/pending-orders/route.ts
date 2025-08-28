import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { withAuth, getUserDataFilter } from '@/lib/permissions';

export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      // 获取用户数据过滤条件
      const dataFilter = await getUserDataFilter();
      
      // 构建查询条件
      const whereClause: Prisma.PhoneNumberWhereInput = {
        reservationStatus: 'PENDING_REVIEW'  // ✅ 只查询待审核状态的订单
      };

      // 应用多租户数据过滤
      if (dataFilter && (dataFilter.schoolIds || dataFilter.departmentIds)) {
        const orgFilters: Prisma.PhoneNumberWhereInput[] = [];
        
        if (dataFilter.schoolIds) {
          orgFilters.push({ schoolId: { in: dataFilter.schoolIds } });
        }
        
        if (dataFilter.departmentIds) {
          orgFilters.push({ departmentId: { in: dataFilter.departmentIds } });
        }
        
        if (orgFilters.length > 0) {
          whereClause.OR = orgFilters;
        }
      }

      const pendingOrders = await prisma.phoneNumber.findMany({
        where: whereClause,
        orderBy: {
          orderTimestamp: 'asc',
        },
        include: {
          school: true,
          department: true
        }
      });
      
      return NextResponse.json(pendingOrders);
    } catch (error) {
      console.error('获取待审核订单失败:', error);
      return NextResponse.json(
        { error: '获取待审核订单失败' },
        { status: 500 }
      );
    }
  }
);
