import { PrismaClient, OrgType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 获取"未分配"学校的ID
 */
export async function getUnassignedSchoolId(): Promise<string> {
  const unassignedSchool = await prisma.organization.findFirst({
    where: {
      name: '未分配',
      type: OrgType.SCHOOL,
      parentId: null
    }
  });
  
  if (!unassignedSchool) {
    throw new Error('未找到"未分配"学校记录，请先运行数据迁移脚本');
  }
  
  return unassignedSchool.id;
}

/**
 * 获取"未分配"院系的ID
 */
export async function getUnassignedDepartmentId(): Promise<string> {
  const unassignedSchoolId = await getUnassignedSchoolId();
  
  const unassignedDept = await prisma.organization.findFirst({
    where: {
      name: '未分配',
      type: OrgType.DEPARTMENT,
      parentId: unassignedSchoolId
    }
  });
  
  if (!unassignedDept) {
    throw new Error('未找到"未分配"院系记录，请先运行数据迁移脚本');
  }
  
  return unassignedDept.id;
}

/**
 * 将号码迁移到"未分配"组织
 */
export async function moveNumbersToUnassigned(departmentId: string): Promise<number> {
  const unassignedSchoolId = await getUnassignedSchoolId();
  const unassignedDeptId = await getUnassignedDepartmentId();
  
  const result = await prisma.phoneNumber.updateMany({
    where: {
      departmentId: departmentId
    },
    data: {
      schoolId: unassignedSchoolId,
      departmentId: unassignedDeptId
    }
  });
  
  return result.count;
}

/**
 * 获取"未分配"组织信息
 */
export async function getUnassignedOrganizations() {
  const unassignedSchool = await prisma.organization.findFirst({
    where: {
      name: '未分配',
      type: OrgType.SCHOOL,
      parentId: null
    },
    include: {
      children: {
        where: {
          name: '未分配',
          type: OrgType.DEPARTMENT
        }
      }
    }
  });
  
  return {
    school: unassignedSchool,
    department: unassignedSchool?.children[0] || null
  };
}