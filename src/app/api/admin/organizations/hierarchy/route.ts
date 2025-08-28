import { NextRequest, NextResponse } from 'next/server';
import { OrgType } from '@prisma/client';
import prisma from '@/lib/prisma';
import { withAuth, getUserDataFilter } from '@/lib/permissions';

interface OrganizationWithStats {
  id: string;
  name: string;
  type: OrgType;
  description?: string | null;
  parentId?: string | null;
  children: OrganizationWithStats[];
  stats: {
    userCount: number;
    numberCount: number;
    availableNumbers: number;
    pendingReview: number;
  };
}

export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      // 获取用户数据过滤条件
      const dataFilter = await getUserDataFilter();
      const whereClause: any = {};
      
      // 应用多租户数据过滤
      if (dataFilter && dataFilter.organizationIds) {
        whereClause.id = { in: dataFilter.organizationIds };
      }

      // 获取所有组织数据
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
            select: { id: true, name: true, type: true, description: true }
          },
          _count: {
            select: {
              userOrgs: true
            }
          }
        }
      });

      // 获取每个组织的统计信息
      const organizationsWithStats: OrganizationWithStats[] = [];
      
      for (const org of organizations) {
        // 构建号码查询条件
        const numberWhereClause: any = {};
        if (org.type === 'SCHOOL') {
          numberWhereClause.schoolId = org.id;
        } else if (org.type === 'DEPARTMENT') {
          numberWhereClause.departmentId = org.id;
        }

        // 获取统计数据
        const [numberCount, availableNumbers, pendingReview] = await Promise.all([
          prisma.phoneNumber.count({ where: numberWhereClause }),
          prisma.phoneNumber.count({
            where: {
              ...numberWhereClause,
              reservationStatus: 'UNRESERVED'
            }
          }),
          prisma.phoneNumber.count({
            where: {
              ...numberWhereClause,
              reservationStatus: 'PENDING_REVIEW'
            }
          })
        ]);

        organizationsWithStats.push({
          id: org.id,
          name: org.name,
          type: org.type,
          description: org.description,
          parentId: org.parentId,
          children: [], // 将在构建层级时填充
          stats: {
            userCount: org._count.userOrgs,
            numberCount,
            availableNumbers,
            pendingReview
          }
        });
      }

      // 构建层级结构
      const buildHierarchy = (parentId: string | null = null): OrganizationWithStats[] => {
        return organizationsWithStats
          .filter(org => org.parentId === parentId)
          .map(org => ({
            ...org,
            children: buildHierarchy(org.id)
          }));
      };

      const hierarchy = buildHierarchy();

      return NextResponse.json({
        success: true,
        data: hierarchy,
        meta: {
          totalOrganizations: organizationsWithStats.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('获取组织层级数据失败:', error);
      return NextResponse.json(
        { 
          success: false,
          error: '获取组织层级数据失败',
          message: error instanceof Error ? error.message : '未知错误'
        },
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