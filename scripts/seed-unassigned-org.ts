import { PrismaClient, OrgType } from '@prisma/client';

const prisma = new PrismaClient();

async function createUnassignedOrganizations() {
  console.log('开始创建"未分配"默认组织记录...');
  
  try {
    // 检查是否已存在"未分配"学校
    const existingSchool = await prisma.organization.findFirst({
      where: {
        name: '未分配',
        type: OrgType.SCHOOL,
        parentId: null
      }
    });
    
    let unassignedSchool;
    
    if (existingSchool) {
      console.log('"未分配"学校已存在，跳过创建');
      unassignedSchool = existingSchool;
    } else {
      // 创建"未分配"学校
      unassignedSchool = await prisma.organization.create({
        data: {
          name: '未分配',
          type: OrgType.SCHOOL,
          parentId: null
        }
      });
      console.log('✅ 创建"未分配"学校成功');
    }
    
    // 检查是否已存在"未分配"院系
    const existingDepartment = await prisma.organization.findFirst({
      where: {
        name: '未分配',
        type: OrgType.DEPARTMENT,
        parentId: unassignedSchool.id
      }
    });
    
    if (existingDepartment) {
      console.log('"未分配"院系已存在，跳过创建');
    } else {
      // 创建"未分配"院系
      await prisma.organization.create({
        data: {
          name: '未分配',
          type: OrgType.DEPARTMENT,
          parentId: unassignedSchool.id
        }
      });
      console.log('✅ 创建"未分配"院系成功');
    }
    
    console.log('🎉 "未分配"默认组织记录创建完成！');
    
  } catch (error) {
    console.error('❌ 创建"未分配"组织记录失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createUnassignedOrganizations()
    .then(() => {
      console.log('脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

export { createUnassignedOrganizations };