import {NextResponse} from 'next/server';
import prisma from '@/lib/prisma';
import {ReservationStatus} from '@prisma/client';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            numberId,
            customerName,
            customerContact,
            shippingAddress,
            paymentAmount,
        } = body;

        // 基础验证
        if (!numberId || !customerName || !customerContact || !paymentAmount) {
            return new NextResponse('缺少必要信息', {status: 400});
        }

        if (paymentAmount === 200 && !shippingAddress) {
            return new NextResponse('选择200元全款时必须填写收货地址', {status: 400});
        }

        // 关键：在事务中检查号码是否仍然可用，防止并发问题
        const updatedNumber = await prisma.$transaction(async (tx) => {
            const numberToReserve = await tx.phoneNumber.findUnique({
                where: {id: numberId},
            });

            if (numberToReserve?.reservationStatus !== ReservationStatus.UNRESERVED) {
                throw new Error('该号码已被预定或正在审核中，请选择其他号码。');
            }

            // 更新号码记录
            return tx.phoneNumber.update({
                where: {id: numberId},
                data: {
                    reservationStatus: 'PENDING_REVIEW',
                    orderTimestamp: new Date(),
                    customerName,
                    customerContact,
                    shippingAddress: shippingAddress || null,
                    paymentAmount: parseFloat(paymentAmount),
                },
            });
        });

        return NextResponse.json(updatedNumber, {status: 201});

    } catch (error: unknown) {
        console.error('[CREATE_ORDER_API_ERROR]', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        if (errorMessage.includes('该号码已被预定')) {
            return new NextResponse(JSON.stringify({error: errorMessage}), {
                status: 409,
                headers: {'Content-Type': 'application/json'}
            }); // 返回JSON格式
        }
        return new NextResponse(JSON.stringify({error: errorMessage}), {status: 500});
    }
}
