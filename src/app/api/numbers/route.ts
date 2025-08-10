import {NextRequest, NextResponse} from 'next/server';
import prisma from '@/lib/prisma';
import {ReservationStatus} from '@prisma/client';

export async function GET(request: NextRequest) {
    try {
        const {searchParams} = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const hideReserved = searchParams.get('hideReserved') === 'true';
        const limit = 100;
        const skip = (page - 1) * limit;

        // 构建动态查询条件
        const where: { reservationStatus?: ReservationStatus } = {};
        if (hideReserved) {
            where.reservationStatus = 'UNRESERVED';
        }

        const phoneNumbers = await prisma.phoneNumber.findMany({
            where, // 应用查询条件
            // 修正：orderBy 的值应该是一个数组，以支持多字段排序
            orderBy: [
                {isPremium: 'desc'}, // 靓号优先
                {phoneNumber: 'asc'},
            ],
            skip,
            take: limit,
        });

        return NextResponse.json(phoneNumbers, {status: 200});
    } catch (error) {
        console.error('[GET_NUMBERS_API_ERROR]', error);
        return new NextResponse(JSON.stringify({error: '服务器内部错误'}), {
            status: 500,
            headers: {'Content-Type': 'application/json'},
        });
    }
}
