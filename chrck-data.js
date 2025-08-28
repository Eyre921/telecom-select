const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    const userCount = await prisma.user.count();
    const orgCount = await prisma.organization.count();
    const phoneCount = await prisma.phoneNumber.count();
    
    console.log(`用户数量: ${userCount}`);
    console.log(`组织数量: ${orgCount}`);
    console.log(`号码数量: ${phoneCount}`);
    
    if (userCount > 0) {
      const users = await prisma.user.findMany({ take: 3 });
      console.log('前3个用户:', JSON.stringify(users, null, 2));
    }
  } catch (error) {
    console.error('查询错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();