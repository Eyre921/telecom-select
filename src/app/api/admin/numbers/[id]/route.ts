import {NextRequest, NextResponse} from 'next/server';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '@/lib/auth';
import prisma from '@/lib/prisma';

// PATCH 方法用于更新单个号码记录
export async function PATCH(
    request: any, // 修改为 any
    {params}: any  // 修改为 any
) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return new NextResponse(JSON.stringify({error: '未授权访问'}), {status: 401});
    }

    const {id} = params; // 正确地从 params 中解构 id
    if (!id) {
        return new NextResponse(JSON.stringify({error: '缺少号码ID'}), {status: 400});
    }

    try {
        const body = await request.json();

        // 防止关键信息被意外修改
        delete body.id;
        delete body.phoneNumber;
        delete body.createdAt;

        const updatedPhoneNumber = await prisma.phoneNumber.update({
            where: {id},
            data: body,
        });

        return NextResponse.json(updatedPhoneNumber, {status: 200});
    } catch (error) {
        console.error(`[ADMIN_UPDATE_NUMBER_API_ERROR] ID: ${id}`, error);
        return new NextResponse(JSON.stringify({error: '更新失败'}), {status: 500});
    }
}

// DELETE 方法用于删除单个号码记录
export async function DELETE(
    request: any, // 修改为 any
    {params}: any  // 修改为 any
) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'ADMIN') {
        return new NextResponse(JSON.stringify({error: '权限不足'}), {status: 403});
    }

    const {id} = params;
    if (!id) {
        return new NextResponse(JSON.stringify({error: '缺少号码ID'}), {status: 400});
    }

    try {
        await prisma.phoneNumber.delete({
            where: {id},
        });

        return new NextResponse(null, {status: 204}); // 204 No Content 表示成功删除
    } catch (error) {
        console.error(`[ADMIN_DELETE_NUMBER_API_ERROR] ID: ${id}`, error);
        return new NextResponse(JSON.stringify({error: '删除失败'}), {status: 500});
    }
}
