import { NextRequest, NextResponse } from 'next/server';
import { OrgType } from '@prisma/client';
import prisma from '@/lib/prisma';
import { withAuth, getUserDataFilter } from '@/lib/permissions';

export const GET = withAuth(
    async (request: NextRequest, context: { params: any }) => {
        try {
            const { searchParams } = new URL(request.url);
            const type = searchParams.get('type') as OrgType | null;
            const parentId = searchParams.get('parentId');

            // 获取用户数据过滤条件
            const dataFilter = await getUserDataFilter();
            const whereClause: any = {};
            
            if (type) {
                whereClause.type = type;
            }
            
            if (parentId) {
                whereClause.parentId = parentId;
            }
            
            // 应用多租户数据过滤
            if (dataFilter && dataFilter.organizationIds) {
                if (whereClause.parentId || whereClause.type) {
                    whereClause.AND = [
                        { id: { in: dataFilter.organizationIds } },
                        ...(whereClause.type ? [{ type: whereClause.type }] : []),
                        ...(whereClause.parentId ? [{ parentId: whereClause.parentId }] : [])
                    ];
                    delete whereClause.type;
                    delete whereClause.parentId;
                } else {
                    whereClause.id = { in: dataFilter.organizationIds };
                }
            }

            const organizations = await prisma.organization.findMany({
                where: whereClause,
                orderBy: {
                    name: 'asc'
                },
                include: {
                    parent: {
                        select: { id: true, name: true, type: true }
                    },
                    children: {
                        select: { id: true, name: true, type: true }
                    }
                }
            });

            return NextResponse.json(organizations);
        } catch (error) {
            console.error('获取组织数据失败:', error);
            return NextResponse.json(
                { error: '获取组织数据失败' },
                { status: 500 }
            );
        }
    },
    {
        requiredRole: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'MARKETER'],
        resourceType: 'organization',
        action: 'read'
    }
);