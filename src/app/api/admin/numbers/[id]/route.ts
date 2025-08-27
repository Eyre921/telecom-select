import {NextRequest, NextResponse} from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, checkResourcePermission } from '@/lib/permissions';

// PATCH 方法用于更新单个号码记录
export const PATCH = withAuth(
    async (
        request: NextRequest,
        {params}: {params: Promise<{id: string}>}
    ) => {
        const {id} = await params;
        if (!id) {
            return NextResponse.json(
                {error: '缺少号码ID'},
                {status: 400}
            );
        }

        try {
            // 检查对该号码的访问权限
            const permission = await checkResourcePermission('phone_number', id, 'write');
            if (!permission.hasPermission) {
                return NextResponse.json(
                    { error: permission.error || '无权限修改该号码' },
                    { status: 403 }
                );
            }

            const body = await request.json();

            // 防止关键信息被意外修改
            delete body.id;
            delete body.phoneNumber;
            delete body.createdAt;
            
            // 删除关联对象数据，只保留ID字段
            delete body.school;
            delete body.department;
            
            // 确保日期字段格式正确
            if (body.orderTimestamp) {
                body.orderTimestamp = new Date(body.orderTimestamp);
            }
            if (body.updatedAt) {
                body.updatedAt = new Date(body.updatedAt);
            }

            const updatedPhoneNumber = await prisma.phoneNumber.update({
                where: {id},
                data: body,
                include: {
                    school: true,
                    department: true
                }
            });

            return NextResponse.json(updatedPhoneNumber, {status: 200});
        } catch (error: unknown) {
            console.error(`[ADMIN_UPDATE_NUMBER_API_ERROR] ID: ${id}`, error);
            return NextResponse.json(
                {error: '更新失败'},
                {status: 500}
            );
        }
    },
    {
        requiredRole: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'MARKETER'],
        resourceType: 'phone_number',
        action: 'write'
    }
);

// DELETE 方法用于删除单个号码记录
export const DELETE = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: '缺少号码ID' },
        { status: 400 }
      );
    }

    try {
      // 检查对该号码的删除权限
      const permission = await checkResourcePermission('phone_number', id, 'delete');
      if (!permission.hasPermission) {
        return NextResponse.json(
          { error: permission.error || '无权限删除该号码' },
          { status: 403 }
        );
      }

      await prisma.phoneNumber.delete({
        where: { id }
      });

      return NextResponse.json({ message: '号码删除成功' });
    } catch (error) {
      console.error('删除号码失败:', error);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }
  },
  {
    requiredRole: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    resourceType: 'phone_number',
    action: 'delete'
  }
);
