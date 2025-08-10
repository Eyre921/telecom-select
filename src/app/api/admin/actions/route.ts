import {NextRequest, NextResponse} from 'next/server';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '@/lib/auth';
import prisma from '@/lib/prisma';
import {ReservationStatus} from '@prisma/client';

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'ADMIN') {
        return new NextResponse(JSON.stringify({error: '权限不足'}), {status: 403});
    }

    try {
        const body = await request.json();
        const {action, payload} = body;

        switch (action) {
            case 'CLEAR_ALL_NUMBERS':
                const deleted = await prisma.phoneNumber.deleteMany({});
                return NextResponse.json({message: `成功清除 ${deleted.count} 条号码信息。`});

            case 'BAN_PREFIX':
                if (!payload?.prefix) throw new Error('缺少号段前缀');
                const updated = await prisma.phoneNumber.updateMany({
                    where: {
                        phoneNumber: {startsWith: payload.prefix},
                        // 核心优化：只锁定当前未预定的号码
                        reservationStatus: ReservationStatus.UNRESERVED
                    },
                    data: {reservationStatus: ReservationStatus.RESERVED, customerName: '系统锁定(禁售)'},
                });
                return NextResponse.json({message: `成功禁售 ${updated.count} 个以 ${payload.prefix} 开头的号码。`});

            case 'UNBAN_PREFIX':
                if (!payload?.prefix) throw new Error('缺少号段前缀');
                const released = await prisma.phoneNumber.updateMany({
                    where: {
                        phoneNumber: {startsWith: payload.prefix},
                        // 核心优化：只解锁由系统禁售的号码
                        customerName: '系统锁定(禁售)'
                    },
                    data: {
                        reservationStatus: ReservationStatus.UNRESERVED,
                        customerName: null,
                        orderTimestamp: null, paymentAmount: null, paymentMethod: null,
                        transactionId: null, customerContact: null, shippingAddress: null,
                    },
                });
                return NextResponse.json({message: `成功解禁 ${released.count} 个以 ${payload.prefix} 开头的号码。`});

            default:
                return new NextResponse(JSON.stringify({error: '无效的操作'}), {status: 400});
        }
    } catch (error: any) {
        console.error('[ADMIN_ACTIONS_API_ERROR]', error);
        return new NextResponse(JSON.stringify({error: error.message || '服务器内部错误'}), {status: 500});
    }
}
