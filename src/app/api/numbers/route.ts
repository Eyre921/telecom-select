import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        // 为客户端视图获取数据库中的所有号码
        const phoneNumbers = await prisma.phoneNumber.findMany({
            orderBy: {
                // 您可以按特定方式对它们进行排序，例如按号码升序
                phoneNumber: 'asc',
            },
        });

        return NextResponse.json(phoneNumbers, { status: 200 });
    } catch (error) {
        console.error('[GET_NUMBERS_API_ERROR]', error);
        return new NextResponse(JSON.stringify({ error: '服务器内部错误' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
