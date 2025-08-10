import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function GET() {
    // 1. 权限保护：检查用户是否登录
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return new NextResponse(JSON.stringify({ error: '未授权访问' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        // 2. 并行执行多个数据库查询以提高效率
        const [totalNumbers, availableNumbers, pendingReview] = await prisma.$transaction([
            // 查询总号码数
            prisma.phoneNumber.count(),
            // 查询剩余可选号码数
            prisma.phoneNumber.count({
                where: { reservationStatus: 'UNRESERVED' },
            }),
            // 查询待审核订单数
            prisma.phoneNumber.count({
                where: { reservationStatus: 'PENDING_REVIEW' },
            }),
        ]);

        // 3. 查询今日新增订单数
        // 获取今天的起始时间
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const newOrdersToday = await prisma.phoneNumber.count({
            where: {
                // orderTimestamp 必须大于或等于今天的起始时间
                orderTimestamp: {
                    gte: startOfToday,
                },
            },
        });

        // 4. 组装统计数据
        const stats = {
            totalNumbers,
            availableNumbers,
            pendingReview,
            newOrdersToday,
        };

        // 5. 返回JSON格式的统计数据
        return NextResponse.json(stats, { status: 200 });

    } catch (error) {
        console.error('[ADMIN_GET_STATS_API_ERROR]', error);
        return new NextResponse(JSON.stringify({ error: '服务器内部错误' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
