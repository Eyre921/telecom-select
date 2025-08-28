import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { ReservationStatus, Prisma } from '@prisma/client';
import { withAuth, getUserDataFilter } from '@/lib/permissions';

export const GET = withAuth(
    async (request: NextRequest) => {
        try {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            
            // 获取用户数据过滤条件
            const dataFilter = await getUserDataFilter();
            const whereClause: Prisma.PhoneNumberWhereInput = {};
            
            // 应用多租户数据过滤
            if (dataFilter) {
                const orgFilters: Prisma.PhoneNumberWhereInput[] = [];
                
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
    },
    {
        requiredRole: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'MARKETER'],
        action: 'read'
    }
);
