import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  // 构建查询条件
  const whereClause: Prisma.PhoneNumberWhereInput = {};

  const orgFilters: Prisma.PhoneNumberWhereInput[] = [];

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
}
