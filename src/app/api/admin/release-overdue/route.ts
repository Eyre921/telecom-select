import {NextResponse} from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, getUserDataFilter } from '@/lib/permissions';
import { Prisma } from '@prisma/client';

export const POST = withAuth(
    async () => {
        try {
            // 获取用户数据过滤条件
            const dataFilter = await getUserDataFilter();
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            
            // 构建查询条件 - 使用正确的 Prisma 类型
            const whereClause: Prisma.PhoneNumberWhereInput = {
                reservationStatus: 'PENDING_REVIEW',
                orderTimestamp: {
                    lt: thirtyMinutesAgo,
                },
            };
            
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

            const result = await prisma.phoneNumber.updateMany({
                where: whereClause,
                data: {
                    reservationStatus: 'UNRESERVED',
                    orderTimestamp: null,
                    paymentAmount: null,
                    paymentMethod: null,
                    transactionId: null,
                    customerName: null,
                    customerContact: null,
                    shippingAddress: null,
                },
            });

            return NextResponse.json({releasedCount: result.count}, {status: 200});
        } catch (error) {
            console.error('[ADMIN_RELEASE_OVERDUE_API_ERROR]', error);
            return NextResponse.json({error: '服务器内部错误'}, {status: 500});
        }
    },
    {
        requiredRole: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'MARKETER'],
        action: 'write'
    }
);
