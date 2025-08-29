import {NextRequest, NextResponse} from 'next/server';
import prisma from '@/lib/prisma';
import {ReservationStatus, Prisma} from '@prisma/client';
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
        const marketer = searchParams.get('marketer');
        const limit = 100;
        const skip = (page - 1) * limit;

        // 获取用户数据过滤条件
        const dataFilter = await getUserDataFilter();
        
        // 构建动态查询条件
        const where: Prisma.PhoneNumberWhereInput = {};
        
        if (hideReserved) {
            where.reservationStatus = 'UNRESERVED';
        }
        
        // 如果提供了marketer参数，需要根据该marketer的权限过滤数据
        if (marketer) {
            // 获取指定marketer的权限信息
            const marketerUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { username: marketer },
                        { email: marketer },
                        { id: marketer },
                        { name: marketer }  // 添加对name字段的支持
                    ]
                },
                include: { organizations: { include: { organization: true } } }
            });
            
            if (marketerUser && (marketerUser.role === 'MARKETER' || marketerUser.role === 'SUPER_ADMIN' || marketerUser.role === 'SCHOOL_ADMIN')) {
                // 获取该用户的组织权限
                const userOrgIds = marketerUser.organizations.map(uo => uo.organization.id);
                const userSchoolIds = marketerUser.organizations
                    .filter(uo => uo.organization.type === 'SCHOOL')
                    .map(uo => uo.organization.id);
                const userDepartmentIds = marketerUser.organizations
                    .filter(uo => uo.organization.type === 'DEPARTMENT')
                    .map(uo => uo.organization.id);
                
                // 如果用户有学校权限，还需要包含该学校下的所有院系
                if (userSchoolIds.length > 0) {
                    const departments = await prisma.organization.findMany({
                        where: {
                            type: 'DEPARTMENT',
                            parentId: { in: userSchoolIds }
                        },
                        select: { id: true }
                    });
                    
                    departments.forEach(dept => {
                        if (!userDepartmentIds.includes(dept.id)) {
                            userDepartmentIds.push(dept.id);
                        }
                    });
                }
                
                // 应用用户的权限过滤
                if (userSchoolIds.length > 0 || userDepartmentIds.length > 0) {
                    const orgFilters = [];
                    if (userSchoolIds.length > 0) {
                        orgFilters.push({ schoolId: { in: userSchoolIds } });
                    }
                    if (userDepartmentIds.length > 0) {
                        orgFilters.push({ departmentId: { in: userDepartmentIds } });
                    }
                    where.OR = orgFilters;
                }
            } else {
                // 如果用户不存在或不是有效角色，返回空结果
                return NextResponse.json([]);
            }
        } else {
            // 原有的权限过滤逻辑
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
