import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma, ReservationStatus } from '@prisma/client';
import { withAuth, getUserDataFilter } from '@/lib/permissions';

export const GET = withAuth(
    async (request: NextRequest) => {
        try {
            const { searchParams } = new URL(request.url);
            const search = searchParams.get('search');
            const schoolId = searchParams.get('schoolId');
            const departmentId = searchParams.get('departmentId');
            const phonePrefix = searchParams.get('phonePrefix');
            const assignedMarketer = searchParams.get('assignedMarketer');
            const reservationStatusParam = searchParams.get('reservationStatus');
            const format = searchParams.get('format') || 'json';
            
            // 获取用户数据过滤条件
            const dataFilter = await getUserDataFilter();
            const whereClause: Prisma.PhoneNumberWhereInput = {};
            
            // 应用多租户数据过滤
            if (dataFilter) {
                const orgFilters: Prisma.PhoneNumberWhereInput[] = [];
                
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
            
            // 添加dashboard筛选条件
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
                    const existingConditions: Prisma.PhoneNumberWhereInput[] = [];
                    
                    if (whereClause.AND) {
                        if (Array.isArray(whereClause.AND)) {
                            existingConditions.push(...whereClause.AND);
                        } else {
                            existingConditions.push(whereClause.AND);
                        }
                    }
                    
                    if (whereClause.OR) {
                        existingConditions.push({ OR: whereClause.OR });
                    }
                    
                    whereClause.AND = [...existingConditions, { departmentId }];
                    delete whereClause.OR;
                } else {
                    whereClause.departmentId = departmentId;
                }
            }

            // 添加导出模态框的筛选条件
            const additionalFilters: Prisma.PhoneNumberWhereInput[] = [];
            
            if (phonePrefix) {
                additionalFilters.push({ phoneNumber: { startsWith: phonePrefix } });
            }
            
            if (assignedMarketer) {
                additionalFilters.push({ assignedMarketer: { contains: assignedMarketer } });
            }
            
            // 修复：正确处理 reservationStatus 类型转换
            if (reservationStatusParam) {
                // 验证并转换为正确的枚举类型
                const validStatuses: ReservationStatus[] = ['UNRESERVED', 'PENDING_REVIEW', 'RESERVED'];
                if (validStatuses.includes(reservationStatusParam as ReservationStatus)) {
                    additionalFilters.push({ reservationStatus: reservationStatusParam as ReservationStatus });
                }
            }

            if (search) {
                additionalFilters.push({
                    OR: [
                        { phoneNumber: { contains: search } },
                        { customerName: { contains: search } },
                        { customerContact: { contains: search } },
                        { assignedMarketer: { contains: search } },
                    ]
                });
            }
            
            // 合并所有筛选条件
            if (additionalFilters.length > 0) {
                if (whereClause.AND) {
                    const existingAndConditions: Prisma.PhoneNumberWhereInput[] = 
                        Array.isArray(whereClause.AND) 
                            ? whereClause.AND 
                            : [whereClause.AND];
                    whereClause.AND = [...existingAndConditions, ...additionalFilters];
                } else if (whereClause.OR) {
                    whereClause.AND = [{ OR: whereClause.OR }, ...additionalFilters];
                    delete whereClause.OR;
                } else {
                    whereClause.AND = additionalFilters;
                }
            }

            // 获取所有符合条件的数据
            const numbers = await prisma.phoneNumber.findMany({
                where: whereClause,
                include: {
                    school: true,
                    department: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            return NextResponse.json({
                data: numbers,
                total: numbers.length,
                filters: {
                    schoolId,
                    departmentId,
                    phonePrefix,
                    assignedMarketer,
                    reservationStatus: reservationStatusParam, // 修复：使用正确的变量名
                    search
                }
            });
        } catch (error) {
            console.error('导出数据获取失败:', error);
            return NextResponse.json(
                { error: '导出数据获取失败' },
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