import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ReservationStatus } from '@prisma/client';
import { withAuth, getUserPermissions, getUserDataFilter } from '@/lib/permissions';

export const POST = withAuth(
  async (request: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    try {
      const body = await request.json();
      const { action, payload } = body;
      
      // 获取用户权限信息
      const userPermission = await getUserPermissions();
      if (!userPermission.hasPermission) {
        return new Response(
          JSON.stringify({ error: '权限不足' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // 获取用户数据过滤条件
      const dataFilter = await getUserDataFilter();
      if (!dataFilter) {
        return new Response(
          JSON.stringify({ error: '无法获取数据过滤条件' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      switch (action) {
        case 'CLEAR_ALL_NUMBERS':
          let whereCondition = {};
          
          // 应用多租户数据过滤
          if (dataFilter.schoolIds && dataFilter.schoolIds.length > 0) {
            whereCondition = {
              schoolId: { in: dataFilter.schoolIds }
            };
          }
          
          const deleted = await prisma.phoneNumber.deleteMany({
            where: whereCondition
          });
          
          const scopeMessage = dataFilter.schoolIds ? '本校' : '所有';
          return new Response(
            JSON.stringify({
              message: `成功清除 ${scopeMessage} ${deleted.count} 条号码信息。`
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );

        case 'BAN_PREFIX':
          if (!payload?.prefix) {
            return new Response(
              JSON.stringify({ error: '缺少号段前缀' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          const banWhereCondition: Prisma.PhoneNumberWhereInput = {
            phoneNumber: { startsWith: payload.prefix }
          };
          
          // 应用多租户数据过滤
          if (dataFilter.schoolIds && dataFilter.schoolIds.length > 0) {
            banWhereCondition.schoolId = { in: dataFilter.schoolIds };
          }
          
          const updated = await prisma.phoneNumber.updateMany({
            where: banWhereCondition,
            data: {
              reservationStatus: ReservationStatus.RESERVED,
              customerName: '系统锁定(禁售)'
            },
          });
          
          return new Response(
            JSON.stringify({
              message: `成功禁售 ${updated.count} 个以 ${payload.prefix} 开头的号码。`
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );

        case 'UNBAN_PREFIX':
          if (!payload?.prefix) {
            return new Response(
              JSON.stringify({ error: '缺少号段前缀' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          const unbanWhereCondition: Prisma.PhoneNumberWhereInput = {
            phoneNumber: { startsWith: payload.prefix },
            customerName: '系统锁定(禁售)'
          };
          
          // 应用多租户数据过滤
          if (dataFilter.schoolIds && dataFilter.schoolIds.length > 0) {
            unbanWhereCondition.schoolId = { in: dataFilter.schoolIds };
          }
          
          const released = await prisma.phoneNumber.updateMany({
            where: unbanWhereCondition,
            data: {
              reservationStatus: ReservationStatus.UNRESERVED,
              customerName: null,
              orderTimestamp: null,
              paymentAmount: null,
              paymentMethod: null,
              transactionId: null,
              customerContact: null,
              shippingAddress: null,
            },
          });
          
          return new Response(
            JSON.stringify({
              message: `成功解禁 ${released.count} 个以 ${payload.prefix} 开头的号码。`
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );

        default:
          return new Response(
            JSON.stringify({ error: '无效的操作' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
      }
    } catch (error: unknown) {
      console.error('[ADMIN_ACTIONS_API_ERROR]', error);
      const errorMessage = error instanceof Error ? error.message : '服务器内部错误';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
  {
    requiredRole: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    action: 'write'
  }
);
