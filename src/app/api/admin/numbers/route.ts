import {NextRequest, NextResponse} from 'next/server';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '@/lib/auth'; // **关键修复**: 从正确的 @/lib/auth 路径导入
import prisma from '@/lib/prisma';
import {Prisma} from '@prisma/client';

export async function GET(request: NextRequest) {
    // 使用正确的 authOptions 来获取 session
    const session = await getServerSession(authOptions);
    if (!session) {
        // 如果 session 无效，返回 401 未授权错误
        return new NextResponse(JSON.stringify({error: '未授权'}), {status: 401});
    }

    try {
        const {searchParams} = new URL(request.url);
        const searchTerm = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const skip = (page - 1) * limit;
        const sort = JSON.parse(searchParams.get('sort') || '{}');

        // 移除了不被支持的 'mode: "insensitive"' 属性，确保兼容性
        const where: Prisma.PhoneNumberWhereInput = searchTerm
            ? {
                OR: [
                    {phoneNumber: {contains: searchTerm}},
                    {customerName: {contains: searchTerm}},
                    {customerContact: {contains: searchTerm}},
                    {assignedMarketer: {contains: searchTerm}},
                ],
            }
            : {};

        const orderBy: Prisma.PhoneNumberOrderByWithRelationInput = sort.field
            ? {[sort.field]: sort.direction}
            : {createdAt: 'desc'};

        const [phoneNumbers, totalCount] = await prisma.$transaction([
            prisma.phoneNumber.findMany({where, orderBy, skip, take: limit}),
            prisma.phoneNumber.count({where})
        ]);

        return NextResponse.json({
            data: phoneNumbers,
            total: totalCount,
            page,
            limit
        }, {status: 200});

    } catch (error) {
        console.error('[ADMIN_GET_NUMBERS_API_ERROR]', error);
        return new NextResponse(JSON.stringify({error: '服务器内部错误'}), {status: 500});
    }
}
