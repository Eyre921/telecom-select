import { NextRequest, NextResponse } from 'next/server';
import { OrgType } from '@prisma/client';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/permissions';

// 更新组织
export const PUT = withAuth(
    async (request: NextRequest, { params }: { params: { id: string } }) => {
        try {
            const { id } = params;
            const body = await request.json();
            const { name, description } = body;

            // 验证必填字段
            if (!name) {
                return NextResponse.json(
                    { error: '组织名称为必填项' },
                    { status: 400 }
                );
            }

            // 检查组织是否存在
            const existingOrg = await prisma.organization.findUnique({
                where: { id }
            });

            if (!existingOrg) {
                return NextResponse.json(
                    { error: '组织不存在' },
                    { status: 404 }
                );
            }

            // 检查同级组织名称是否重复（排除自己）
            const duplicateOrg = await prisma.organization.findFirst({
                where: {
                    name,
                    type: existingOrg.type,
                    parentId: existingOrg.parentId,
                    id: { not: id }
                }
            });

            if (duplicateOrg) {
                return NextResponse.json(
                    { error: '同级组织中已存在相同名称的组织' },
                    { status: 400 }
                );
            }

            // 更新组织
            const organization = await prisma.organization.update({
                where: { id },
                data: {
                    name,
                    description: description || null
                },
                include: {
                    parent: {
                        select: { id: true, name: true, type: true }
                    },
                    children: {
                        select: { id: true, name: true, type: true }
                    },
                    userOrgs: true  // 修改：从 userOrganizations 改为 userOrgs
                }
            });

            return NextResponse.json(organization);
        } catch (error) {
            console.error('更新组织失败:', error);
            return NextResponse.json(
                { error: '更新组织失败' },
                { status: 500 }
            );
        }
    },
    {
        requiredRole: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
        resourceType: 'organization',
        action: 'write'  // 修改：从 'update' 改为 'write'
    }
);

// 删除组织
export const DELETE = withAuth(
    async (request: NextRequest, { params }: { params: { id: string } }) => {
        try {
            const { id } = params;

            // 检查组织是否存在
            const existingOrg = await prisma.organization.findUnique({
                where: { id },
                include: {
                    children: true,
                    userOrgs: true  // 修改：从 userOrganizations 改为 userOrgs
                }
            });

            if (!existingOrg) {
                return NextResponse.json(
                    { error: '组织不存在' },
                    { status: 404 }
                );
            }

            // 检查是否有子组织
            if (existingOrg.children.length > 0) {
                return NextResponse.json(
                    { error: '无法删除包含子组织的组织，请先删除或转移子组织' },
                    { status: 400 }
                );
            }

            // 检查是否有用户关联
            if (existingOrg.userOrgs.length > 0) {  // 修改：从 userOrganizations 改为 userOrgs
                return NextResponse.json(
                    { error: '无法删除包含用户的组织，请先转移或删除相关用户' },
                    { status: 400 }
                );
            }

            // 删除组织
            await prisma.organization.delete({
                where: { id }
            });

            return NextResponse.json({ message: '组织删除成功' });
        } catch (error) {
            console.error('删除组织失败:', error);
            return NextResponse.json(
                { error: '删除组织失败' },
                { status: 500 }
            );
        }
    },
    {
        requiredRole: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
        resourceType: 'organization',
        action: 'delete'
    }
);