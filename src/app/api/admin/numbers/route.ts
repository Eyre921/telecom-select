import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse(JSON.stringify({ error: '未授权' }), { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const filters = JSON.parse(searchParams.get('filters') || '[]');
        const sort = JSON.parse(searchParams.get('sort') || '{}');

        // 构建动态 WHERE 条件
        const where: Prisma.PhoneNumberWhereInput = {
            AND: filters.map((filter: any) => {
                const { field, operator, value } = filter;

                // 特殊处理统一搜索框的 OR 条件
                if (field === 'OR') {
                    return { OR: value };
                }

                switch (operator) {
                    case 'contains':
                        return { [field]: { contains: value, mode: 'insensitive' } }; // mode: 'insensitive' for case-insensitive search
                    case 'equals':
                        // 需要根据字段类型转换值
                        const isNumericField = ['paymentAmount'].includes(field);
                        const finalValue = isNumericField ? parseFloat(value) : value;
                        return { [field]: { equals: finalValue } };
                    case 'startsWith':
                        return { [field]: { startsWith: value } };
                    case 'isEmpty':
                        return { [field]: { in: [null, ''] } };
                    case 'isNotEmpty':
                        return { [field]: { notIn: [null, ''] } };
                    default:
                        return {};
                }
            }),
        };

        // 构建动态 ORDER BY 条件
        const orderBy: Prisma.PhoneNumberOrderByWithRelationInput = sort.field
            ? { [sort.field]: sort.direction }
            : { createdAt: 'desc' };

        const phoneNumbers = await prisma.phoneNumber.findMany({ where, orderBy });

        return NextResponse.json(phoneNumbers, { status: 200 });
    } catch (error) {
        console.error('[ADMIN_GET_NUMBERS_API_ERROR]', error);
        return new NextResponse(JSON.stringify({ error: '服务器内部错误' }), { status: 500 });
    }
}

// ... DELETE 方法保持不变 ...
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) { /* ... */ }
