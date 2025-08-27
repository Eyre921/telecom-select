import {NextRequest, NextResponse} from 'next/server';
import prisma from '@/lib/prisma';
import {ReservationStatus} from '@prisma/client';
import { getUserDataFilter } from '@/lib/permissions';

export async function GET(request: NextRequest) {
    try {
        const {searchParams} = new URL(request.url);
        // 添加页面参数验证
        const page = parseInt(searchParams.get('page') || '1');
        if (isNaN(page) || page < 1) {
          return NextResponse.json(
            { error: 'Invalid page parameter' }, 
            { status: 400 }
          );
        }
        const hideReserved = searchParams.get('hideReserved') === 'true';
        const schoolId = searchParams.get('schoolId');
        const departmentId = searchParams.get('departmentId');
        const limit = 100;
        const skip = (page - 1) * limit;

        // 获取用户数据过滤条件
        const dataFilter = await getUserDataFilter();
        
        // 构建动态查询条件
        const where: any = {};
        
        if (hideReserved) {
            where.reservationStatus = 'UNRESERVED';
        }
        
        // 应用多租户数据过滤
        if (dataFilter) {
            const orgFilters = [];
            
            // 学校过滤
            if (dataFilter.schoolIds && dataFilter.schoolIds.length > 0) {
                orgFilters.push({ schoolId: { in: dataFilter.schoolIds } });
            }
            
            // 院系过滤
            if (dataFilter.departmentIds && dataFilter.departmentIds.length > 0) {
                orgFilters.push({ departmentId: { in: dataFilter.departmentIds } });
            }
            
            if (orgFilters.length > 0) {
                where.OR = orgFilters;
            }
        }
        
        // 前端筛选条件
        if (schoolId) {
            where.schoolId = schoolId;
        }
        
        if (departmentId) {
            where.departmentId = departmentId;
        }

        const phoneNumbers = await prisma.phoneNumber.findMany({
            where,
            include: {
                school: {
                    select: { id: true, name: true }
                },
                department: {
                    select: { id: true, name: true }
                }
            },
            orderBy: [
                {isPremium: 'desc'},
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
