import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST method to release all overdue pending orders
export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return new NextResponse(JSON.stringify({error: '未授权访问'}), {status: 401});
    }

    try {
        // Calculate the timestamp for 30 minutes ago
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        // Find all records that are pending review and older than 30 minutes
        const result = await prisma.phoneNumber.updateMany({
            where: {
                reservationStatus: 'PENDING_REVIEW',
                orderTimestamp: {
                    lt: thirtyMinutesAgo, // 'lt' means "less than"
                },
            },
            // Reset the record to its unreserved state
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

        // Return the count of released numbers
        return NextResponse.json({releasedCount: result.count}, {status: 200});

    } catch (error) {
        console.error('[ADMIN_RELEASE_OVERDUE_API_ERROR]', error);
        return new NextResponse(JSON.stringify({error: '服务器内部错误'}), {status: 500});
    }
}
