import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '@/lib/auth'; // **关键修复**: 从正确的 @/lib/auth 路径导入
import prisma from '@/lib/prisma';
import {ReservationStatus} from '@prisma/client';

export async function GET() {
    // 使用正确的 authOptions 来获取 session
    const session = await getServerSession(authOptions);
    if (!session) {
        return new NextResponse(JSON.stringify({error: '未授权'}), {status: 401});
    }

    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [totalNumbers, availableNumbers, pendingReview, newOrdersToday] = await prisma.$transaction([
            prisma.phoneNumber.count(),
            prisma.phoneNumber.count({where: {reservationStatus: ReservationStatus.UNRESERVED}}),
            prisma.phoneNumber.count({where: {reservationStatus: ReservationStatus.PENDING_REVIEW}}),
            prisma.phoneNumber.count({
                where: {
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
        return new NextResponse(JSON.stringify({error: '服务器内部错误'}), {status: 500});
    }
}
