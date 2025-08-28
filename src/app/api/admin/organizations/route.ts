import { NextRequest, NextResponse } from 'next/server';
import { Prisma, OrgType } from '@prisma/client';
import prisma from '@/lib/prisma';
import { withAuth, getUserDataFilter } from '@/lib/permissions';

export const GET = withAuth(
    async (request: NextRequest) => {
        try {
            const { searchParams } = new URL(request.url);
            const type = searchParams.get('type') as OrgType | null;
            const parentId = searchParams.get('parentId');

            // 获取用户数据过滤条件
            const dataFilter = await getUserDataFilter();
            // 构建查询条件
            const whereClause: Prisma.OrganizationWhereInput = {
                // 过滤掉超级管理员组，防止手动选择
                NOT: {
                    id: 'super-admin-org'
                }
            };
            
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

// POST /api/admin/organizations - 创建组织
export const POST = withAuth(
    async (request: NextRequest) => {
        try {
            const body = await request.json();
            const { name, type, description, parentId } = body;

            // 验证必填字段
            if (!name || !type) {
                return NextResponse.json(
                    { error: '组织名称和类型为必填项' },
                    { status: 400 }
                );
            }

            // 验证组织类型
            if (!['SCHOOL', 'DEPARTMENT'].includes(type)) {
                return NextResponse.json(
                    { error: '无效的组织类型' },
                    { status: 400 }
                );
            }

            // 如果是院系，必须有父组织（学校）
            if (type === 'DEPARTMENT' && !parentId) {
                return NextResponse.json(
                    { error: '院系必须指定所属学校' },
                    { status: 400 }
                );
            }

            // 如果指定了父组织，验证父组织是否存在
            if (parentId) {
                const parentOrg = await prisma.organization.findUnique({
                    where: { id: parentId }
                });

                if (!parentOrg) {
                    return NextResponse.json(
                        { error: '指定的父组织不存在' },
                        { status: 400 }
                    );
                }

                // 验证层级关系：院系的父组织必须是学校
                if (type === 'DEPARTMENT' && parentOrg.type !== 'SCHOOL') {
                    return NextResponse.json(
                        { error: '院系的父组织必须是学校' },
                        { status: 400 }
                    );
                }
            }

            // 检查同级组织名称是否重复
            const duplicateOrg = await prisma.organization.findFirst({
                where: {
                    name,
                    type: type as OrgType,
                    parentId: parentId || null
                }
            });

            if (duplicateOrg) {
                return NextResponse.json(
                    { error: '同级组织中已存在相同名称的组织' },
                    { status: 400 }
                );
            }

            // 权限检查：确保用户只能在其管理范围内创建组织
            const dataFilter = await getUserDataFilter();
            if (parentId && dataFilter?.organizationIds && !dataFilter.organizationIds.includes(parentId)) {
                return NextResponse.json(
                    { error: '无权限在该组织下创建子组织' },
                    { status: 403 }
                );
            }

            // 创建组织
            const organization = await prisma.organization.create({
                data: {
                    name,
                    type: type as OrgType,
                    description: description || null,
                    parentId: parentId || null
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

            return NextResponse.json(organization, { status: 201 });
        } catch (error) {
            console.error('创建组织失败:', error);
            return NextResponse.json(
                { error: '创建组织失败' },
                { status: 500 }
            );
        }
    },
    {
        requiredRole: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
        resourceType: 'organization',
        action: 'write'
    }
);