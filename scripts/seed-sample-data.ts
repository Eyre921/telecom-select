import { PrismaClient, OrgType, Role, ReservationStatus, PaymentMethod, DeliveryStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createSampleData() {
  console.log('🚀 开始创建示例数据...');
  
  try {
    // 1. 创建学校组织
    console.log('📚 创建学校组织...');
    const schools = await Promise.all([
      prisma.organization.upsert({
        where: { id: 'school-1' },
        update: {},
        create: {
          id: 'school-1',
          name: '北京大学',
          type: OrgType.SCHOOL,
          parentId: null
        }
      }),
      prisma.organization.upsert({
        where: { id: 'school-2' },
        update: {},
        create: {
          id: 'school-2',
          name: '清华大学',
          type: OrgType.SCHOOL,
          parentId: null
        }
      }),
      prisma.organization.upsert({
        where: { id: 'school-3' },
        update: {},
        create: {
          id: 'school-3',
          name: '中国人民大学',
          type: OrgType.SCHOOL,
          parentId: null
        }
      })
    ]);
    console.log('✅ 学校组织创建完成');

    // 2. 创建院系组织
    console.log('🏛️ 创建院系组织...');
    const departments = await Promise.all([
      // 北京大学院系
      prisma.organization.upsert({
        where: { id: 'dept-1' },
        update: {},
        create: {
          id: 'dept-1',
          name: '计算机学院',
          type: OrgType.DEPARTMENT,
          parentId: schools[0].id
        }
      }),
      prisma.organization.upsert({
        where: { id: 'dept-2' },
        update: {},
        create: {
          id: 'dept-2',
          name: '数学学院',
          type: OrgType.DEPARTMENT,
          parentId: schools[0].id
        }
      }),
      // 清华大学院系
      prisma.organization.upsert({
        where: { id: 'dept-3' },
        update: {},
        create: {
          id: 'dept-3',
          name: '软件学院',
          type: OrgType.DEPARTMENT,
          parentId: schools[1].id
        }
      }),
      prisma.organization.upsert({
        where: { id: 'dept-4' },
        update: {},
        create: {
          id: 'dept-4',
          name: '电子工程系',
          type: OrgType.DEPARTMENT,
          parentId: schools[1].id
        }
      }),
      // 中国人民大学院系
      prisma.organization.upsert({
        where: { id: 'dept-5' },
        update: {},
        create: {
          id: 'dept-5',
          name: '信息学院',
          type: OrgType.DEPARTMENT,
          parentId: schools[2].id
        }
      })
    ]);
    console.log('✅ 院系组织创建完成');

    // 3. 创建用户
    console.log('👥 创建用户...');
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    const users = await Promise.all([
      // 超级管理员
      // 超级管理员
      prisma.user.upsert({
        where: { email: 'admin@system.com' },
        update: {},
        create: {
          name: '系统管理员',
          email: 'admin@system.com',
          password: hashedPassword,
          role: Role.SUPER_ADMIN
        }
      })
      // 注意：超级管理员没有在 userOrgRelations 中被分配任何组织
      // 北京大学校级管理员
      ,prisma.user.upsert({
        where: { email: 'admin@pku.edu.cn' },
        update: {},
        create: {
          name: '北大管理员',
          email: 'admin@pku.edu.cn',
          password: hashedPassword,
          role: Role.SCHOOL_ADMIN
        }
      }),
      // 清华大学校级管理员
      prisma.user.upsert({
        where: { email: 'admin@tsinghua.edu.cn' },
        update: {},
        create: {
          name: '清华管理员',
          email: 'admin@tsinghua.edu.cn',
          password: hashedPassword,
          role: Role.SCHOOL_ADMIN
        }
      }),
      // 销售人员
      prisma.user.upsert({
        where: { email: 'marketer1@telecom.com' },
        update: {},
        create: {
          name: '销售员张三',
          email: 'marketer1@telecom.com',
          password: hashedPassword,
          role: Role.MARKETER
        }
      }),
      prisma.user.upsert({
        where: { email: 'marketer2@telecom.com' },
        update: {},
        create: {
          name: '销售员李四',
          email: 'marketer2@telecom.com',
          password: hashedPassword,
          role: Role.MARKETER
        }
      }),
      prisma.user.upsert({
        where: { email: 'marketer3@telecom.com' },
        update: {},
        create: {
          name: '销售员王五',
          email: 'marketer3@telecom.com',
          password: hashedPassword,
          role: Role.MARKETER
        }
      })
    ]);
    console.log('✅ 用户创建完成');

    // 4. 创建用户组织关系
    console.log('🔗 创建用户组织关系...');
    const userOrgRelations = [
      // 北大管理员关联北大
      {
        userId: users[1].id,
        organizationId: schools[0].id, // 北京大学
        role: Role.SCHOOL_ADMIN
      },
      // 清华管理员关联清华
      {
        userId: users[2].id,
        organizationId: schools[1].id, // 清华大学
        role: Role.SCHOOL_ADMIN
      },
      // 销售员1：北大计算机学院 + 北京大学
      {
        userId: users[3].id,
        organizationId: schools[0].id, // 北京大学
        role: Role.MARKETER
      },
      {
        userId: users[3].id,
        organizationId: departments[0].id, // 北大计算机学院
        role: Role.MARKETER
      },
      // 销售员2：清华软件学院 + 清华大学
      {
        userId: users[4].id,
        organizationId: schools[1].id, // 清华大学
        role: Role.MARKETER
      },
      {
        userId: users[4].id,
        organizationId: departments[2].id, // 清华软件学院
        role: Role.MARKETER
      },
      // 销售员3：人大信息学院 + 中国人民大学
      {
        userId: users[5].id,
        organizationId: schools[2].id, // 中国人民大学
        role: Role.MARKETER
      },
      {
        userId: users[5].id,
        organizationId: departments[4].id, // 人大信息学院
        role: Role.MARKETER
      }
    ];
    
    // 批量创建用户组织关系
    for (const relation of userOrgRelations) {
      await prisma.userOrganization.upsert({
        where: {
          userId_organizationId: {
            userId: relation.userId,
            organizationId: relation.organizationId
          }
        },
        update: {},
        create: relation
      });
    }
    console.log('✅ 用户组织关系创建完成');

    // 5. 创建号码数据
    console.log('📱 创建号码数据...');
    const phoneNumbers = [];
    
    // 为每个院系创建不同状态的号码
    for (let i = 0; i < departments.length; i++) {
      const dept = departments[i];
      const school = schools.find(s => s.id === dept.parentId);
      
      // 每个院系创建20个号码
      for (let j = 1; j <= 20; j++) {
        const phoneNumber = `138${String(i + 1).padStart(2, '0')}${String(j).padStart(6, '0')}`;
        const isPremium = j <= 5; // 前5个是靓号
        const status = j <= 8 ? ReservationStatus.RESERVED : 
                      j <= 12 ? ReservationStatus.PENDING_REVIEW : 
                      ReservationStatus.UNRESERVED;
        
        phoneNumbers.push({
          phoneNumber,
          isPremium,
          premiumReason: isPremium ? '连号/重复数字' : null,
          reservationStatus: status,
          orderTimestamp: status !== ReservationStatus.UNRESERVED ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : null,
          paymentAmount: status === ReservationStatus.RESERVED ? (isPremium ? 200 : 50) : null,
          paymentMethod: status === ReservationStatus.RESERVED ? (Math.random() > 0.5 ? PaymentMethod.WECHAT : PaymentMethod.ALIPAY) : null,
          transactionId: status === ReservationStatus.RESERVED ? `TXN${Date.now()}${j}` : null,
          assignedMarketer: users[3 + (i % 3)].name, // 轮流分配销售员
          customerName: status !== ReservationStatus.UNRESERVED ? `客户${i + 1}-${j}` : null,
          customerContact: status !== ReservationStatus.UNRESERVED ? `contact${i}${j}@example.com` : null,
          shippingAddress: status === ReservationStatus.RESERVED ? `地址${i + 1}-${j}` : null,
          emsTrackingNumber: status === ReservationStatus.RESERVED && j <= 4 ? `EMS${Date.now()}${j}` : null,
          deliveryStatus: status === ReservationStatus.RESERVED ? 
            (j <= 2 ? DeliveryStatus.RECEIVED_UNACTIVATED :
             j <= 4 ? DeliveryStatus.IN_TRANSIT_ACTIVATED :
             j <= 6 ? DeliveryStatus.IN_TRANSIT_UNACTIVATED :
             DeliveryStatus.EMPTY) : null,
          schoolId: school?.id,
          departmentId: dept.id
        });
      }
    }
    
    // 批量创建号码
    for (const phoneData of phoneNumbers) {
      await prisma.phoneNumber.upsert({
        where: { phoneNumber: phoneData.phoneNumber },
        update: {},
        create: phoneData
      });
    }
    
    console.log(`✅ 创建了 ${phoneNumbers.length} 个号码记录`);

    // 6. 统计信息
    const stats = {
      schools: await prisma.organization.count({ where: { type: OrgType.SCHOOL } }),
      departments: await prisma.organization.count({ where: { type: OrgType.DEPARTMENT } }),
      users: await prisma.user.count(),
      userOrganizations: await prisma.userOrganization.count(),
      phoneNumbers: await prisma.phoneNumber.count(),
      reservedNumbers: await prisma.phoneNumber.count({ where: { reservationStatus: ReservationStatus.RESERVED } }),
      pendingNumbers: await prisma.phoneNumber.count({ where: { reservationStatus: ReservationStatus.PENDING_REVIEW } }),
      premiumNumbers: await prisma.phoneNumber.count({ where: { isPremium: true } })
    };
    
    console.log('\n📊 数据统计:');
    console.log(`学校: ${stats.schools} 个`);
    console.log(`院系: ${stats.departments} 个`);
    console.log(`用户: ${stats.users} 个`);
    console.log(`用户组织关系: ${stats.userOrganizations} 个`);
    console.log(`号码总数: ${stats.phoneNumbers} 个`);
    console.log(`已预订号码: ${stats.reservedNumbers} 个`);
    console.log(`待审核号码: ${stats.pendingNumbers} 个`);
    console.log(`靓号数量: ${stats.premiumNumbers} 个`);
    
    console.log('\n👥 测试账号信息:');
    console.log('超级管理员: admin@system.com / 123456');
    console.log('北大管理员: admin@pku.edu.cn / 123456');
    console.log('清华管理员: admin@tsinghua.edu.cn / 123456');
    console.log('销售员1: marketer1@telecom.com / 123456');
    console.log('销售员2: marketer2@telecom.com / 123456');
    console.log('销售员3: marketer3@telecom.com / 123456');
    
    console.log('\n🎉 示例数据创建完成！');
    
  } catch (error) {
    console.error('❌ 创建示例数据失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createSampleData()
    .then(() => {
      console.log('脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

export { createSampleData };