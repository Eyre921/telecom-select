import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { ReservationStatus } from '@prisma/client';
import { withAuth, getUserDataFilter } from '@/lib/permissions';

export const GET = withAuth(
    async (request: NextRequest, context: { params: any }) => {
        try {
            // 获取用户数据过滤条件
            const dataFilter = await getUserDataFilter();
            const whereClause: any = {
                reservationStatus: ReservationStatus.PENDING_REVIEW,
            };
            
            // 应用多租户数据过滤
            if (dataFilter) {
                const orgFilters = [];
                
                if (dataFilter.schoolIds && dataFilter.schoolIds.length > 0) {
                    orgFilters.push({ schoolId: { in: dataFilter.schoolIds } });
                }
                
                if (dataFilter.departmentIds && dataFilter.departmentIds.length > 0) {
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
            console.error('[ADMIN_GET_PENDING_ORDERS_API_ERROR]', error);
            return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
        }
    },
    {
        requiredRole: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'MARKETER'],
        action: 'read'
    }
);
