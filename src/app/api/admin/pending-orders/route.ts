import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ReservationStatus } from '@prisma/client';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new NextResponse(JSON.stringify({ error: '未授权' }), { status: 401 });
    }

    try {
        const pendingOrders = await prisma.phoneNumber.findMany({
            where: {
                reservationStatus: ReservationStatus.PENDING_REVIEW,
            },
            orderBy: {
                orderTimestamp: 'asc', // 优先显示最早的待审核订单
            },
        });
        return NextResponse.json(pendingOrders);
    } catch (error) {
        console.error('[ADMIN_GET_PENDING_ORDERS_API_ERROR]', error);
        return new NextResponse(JSON.stringify({ error: '服务器内部错误' }), { status: 500 });
    }
}
