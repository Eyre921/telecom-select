import {NextRequest, NextResponse} from 'next/server';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '@/lib/auth';
import prisma from '@/lib/prisma';
import {Prisma} from '@prisma/client';
import { withAuth, getUserDataFilter } from '@/lib/permissions';

export const GET = withAuth(
    async (request: NextRequest, context: { params: any }) => {
        try {
            const { searchParams } = new URL(request.url);
            const search = searchParams.get('search');
            const schoolId = searchParams.get('schoolId');
            const departmentId = searchParams.get('departmentId');
            const sortParam = searchParams.get('sort');
            const page = parseInt(searchParams.get('page') || '1');
            const limit = parseInt(searchParams.get('limit') || '50');
            const skip = (page - 1) * limit;

            let sortConfig = { field: 'createdAt', direction: 'desc' };
            if (sortParam) {
                try {
                    sortConfig = JSON.parse(sortParam);
                } catch (e) {
                    console.warn('Invalid sort parameter:', sortParam);
                }
            }

            // 获取用户数据过滤条件
            const dataFilter = await getUserDataFilter();
            const whereClause: any = {};
            
            // 应用多租户数据过滤
            if (dataFilter) {
                const orgFilters = [];
                
                if (dataFilter.schoolIds && dataFilter.schoolIds.length > 0) {
                    orgFilters.push({ schoolId: { in: dataFilter.schoolIds } });
                }
                
                if (dataFilter.departmentIds && dataFilter.departmentIds.length > 0) {
                    orgFilters.push({ departmentId: { in: dataFilter.departmentIds } });
                }
                
                if (orgFilters.length > 0) {
                    whereClause.OR = orgFilters;
                }
            }
            
            // 添加筛选条件
            if (schoolId) {
                if (whereClause.OR) {
                    whereClause.AND = [{ OR: whereClause.OR }, { schoolId }];
                    delete whereClause.OR;
                } else {
                    whereClause.schoolId = schoolId;
                }
            }
            
            if (departmentId) {
                if (whereClause.OR || whereClause.AND) {
                    const existingConditions = whereClause.AND || [{ OR: whereClause.OR }];
                    whereClause.AND = [...existingConditions, { departmentId }];
                    delete whereClause.OR;
                } else {
                    whereClause.departmentId = departmentId;
                }
            }

            if (search) {
                const searchCondition = {
                    OR: [
                        { phoneNumber: { contains: search } },
                        { customerName: { contains: search } },
                        { customerContact: { contains: search } },
                        { assignedMarketer: { contains: search } },
                    ]
                };
                
                if (whereClause.AND) {
                    whereClause.AND.push(searchCondition);
                } else if (whereClause.OR) {
                    whereClause.AND = [{ OR: whereClause.OR }, searchCondition];
                    delete whereClause.OR;
                } else {
                    Object.assign(whereClause, searchCondition);
                }
            }

            const findManyOptions: any = {
                where: whereClause,
                include: {
                    school: true,
                    department: true
                },
                skip,
                take: limit,
                orderBy: {
                    [sortConfig.field]: sortConfig.direction
                }
            };

            const [numbers, total] = await Promise.all([
                prisma.phoneNumber.findMany(findManyOptions),
                prisma.phoneNumber.count({ where: whereClause })
            ]);

            return NextResponse.json({
                data: numbers,
                total,
                page,
                totalPages: Math.ceil(total / limit)
            });
        } catch (error) {
            console.error('获取号码数据失败:', error);
            return NextResponse.json(
                { error: '获取号码数据失败' },
                { status: 500 }
            );
        }
    },
    {
        requiredRole: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'MARKETER'],
        resourceType: 'phone_number',
        action: 'read'
    }
);
