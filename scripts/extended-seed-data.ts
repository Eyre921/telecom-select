import { PrismaClient, OrgType, Role, ReservationStatus, PaymentMethod, DeliveryStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createExtendedTestData() {
  console.log('🚀 开始创建扩展测试数据...');
  
  try {
    // 1. 创建更多学校组织
    console.log('📚 创建扩展学校组织...');
    const schools = await Promise.all([
      // 超级管理员组 - 新增
      prisma.organization.upsert({
        where: { id: 'super-admin-org' },
        update: {},
        create: {
          id: 'super-admin-org',
          name: '超级管理员组',
          type: OrgType.SCHOOL,
          description: '系统超级管理员专用组织，用于管理超级管理员权限',
          parentId: null
        }
      }),
      // 原有学校
      prisma.organization.upsert({
        where: { id: 'school-1' },
        update: {},
        create: {
          id: 'school-1',
          name: '北京大学',
          type: OrgType.SCHOOL,
          description: '中国顶尖综合性大学，以文理基础学科见长',
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
          description: '中国顶尖理工科大学，工程技术领域领先',
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
          description: '人文社会科学高等教育的重要基地',
          parentId: null
        }
      }),
      // 新增学校
      prisma.organization.upsert({
        where: { id: 'school-4' },
        update: {},
        create: {
          id: 'school-4',
          name: '北京师范大学',
          type: OrgType.SCHOOL,
          description: '师范教育的领军学府，教育学心理学优势突出',
          parentId: null
        }
      }),
      prisma.organization.upsert({
        where: { id: 'school-5' },
        update: {},
        create: {
          id: 'school-5',
          name: '北京理工大学',
          type: OrgType.SCHOOL,
          description: '理工科强校，国防科技特色鲜明',
          parentId: null
        }
      }),
      prisma.organization.upsert({
        where: { id: 'school-6' },
        update: {},
        create: {
          id: 'school-6',
          name: '北京航空航天大学',
          type: OrgType.SCHOOL,
          description: '航空航天领域的顶尖学府',
          parentId: null
        }
      })
    ]);
    console.log('✅ 扩展学校组织创建完成');

    // 2. 创建更多院系组织
    console.log('🏛️ 创建扩展院系组织...');
    const departments = await Promise.all([
      // 北京大学院系 (schools[1])
      prisma.organization.upsert({
        where: { id: 'dept-1' },
        update: {},
        create: {
          id: 'dept-1',
          name: '计算机学院',
          type: OrgType.DEPARTMENT,
          description: '计算机科学与技术专业教学研究',
          parentId: schools[1].id  // 修复：北京大学
        }
      }),
      prisma.organization.upsert({
        where: { id: 'dept-2' },
        update: {},
        create: {
          id: 'dept-2',
          name: '数学学院',
          type: OrgType.DEPARTMENT,
          description: '数学基础学科教学与研究',
          parentId: schools[1].id  // 修复：北京大学
        }
      }),
      prisma.organization.upsert({
        where: { id: 'dept-3' },
        update: {},
        create: {
          id: 'dept-3',
          name: '物理学院',
          type: OrgType.DEPARTMENT,
          description: '物理学基础与应用研究',
          parentId: schools[1].id  // 修复：北京大学
        }
      }),
      // 清华大学院系 (schools[2])
      prisma.organization.upsert({
        where: { id: 'dept-4' },
        update: {},
        create: {
          id: 'dept-4',
          name: '软件学院',
          type: OrgType.DEPARTMENT,
          description: '软件工程与技术专业教育',
          parentId: schools[2].id  // 修复：清华大学
        }
      }),
      prisma.organization.upsert({
        where: { id: 'dept-5' },
        update: {},
        create: {
          id: 'dept-5',
          name: '电子工程系',
          type: OrgType.DEPARTMENT,
          description: '电子信息工程技术研究',
          parentId: schools[2].id  // 修复：清华大学
        }
      }),
      prisma.organization.upsert({
        where: { id: 'dept-6' },
        update: {},
        create: {
          id: 'dept-6',
          name: '自动化系',
          type: OrgType.DEPARTMENT,
          description: '自动化控制技术与系统',
          parentId: schools[2].id  // 修复：清华大学
        }
      }),
      // 中国人民大学院系 (schools[3])
      prisma.organization.upsert({
        where: { id: 'dept-7' },
        update: {},
        create: {
          id: 'dept-7',
          name: '信息学院',
          type: OrgType.DEPARTMENT,
          description: '信息管理与信息系统专业',
          parentId: schools[3].id  // 修复：中国人民大学
        }
      }),
      // 北京师范大学院系 (schools[4])
      prisma.organization.upsert({
        where: { id: 'dept-8' },
        update: {},
        create: {
          id: 'dept-8',
          name: '心理学院',
          type: OrgType.DEPARTMENT,
          description: '心理学理论与应用研究',
          parentId: schools[4].id  // 修复：北京师范大学
        }
      }),
      // 北京理工大学院系 (schools[5])
      prisma.organization.upsert({
        where: { id: 'dept-9' },
        update: {},
        create: {
          id: 'dept-9',
          name: '机械工程学院',
          type: OrgType.DEPARTMENT,
          description: '机械设计制造及自动化',
          parentId: schools[5].id  // 修复：北京理工大学
        }
      }),
      // 北京航空航天大学院系 (schools[6])
      prisma.organization.upsert({
        where: { id: 'dept-10' },
        update: {},
        create: {
          id: 'dept-10',
          name: '航空学院',
          type: OrgType.DEPARTMENT,
          description: '航空航天工程技术',
          parentId: schools[6].id  // 修复：北京航空航天大学
        }
      })
    ]);
    console.log('✅ 扩展院系组织创建完成');

    // 3. 创建扩展用户（适配新的数据库结构）
    console.log('👥 创建扩展用户...');
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    const users = await Promise.all([
      // 超级管理员
      prisma.user.upsert({
        where: { email: 'admin@system.com' },
        update: {},
        create: {
          username: 'superadmin',
          name: '系统管理员',
          phone: '13800000001',
          email: 'admin@system.com',
          password: hashedPassword,
          role: Role.SUPER_ADMIN
        }
      }),
      // 各学校管理员
      prisma.user.upsert({
        where: { email: 'admin@pku.edu.cn' },
        update: {},
        create: {
          username: 'pkuadmin',
          name: '北大管理员',
          phone: '13800000002',
          email: 'admin@pku.edu.cn',
          password: hashedPassword,
          role: Role.SCHOOL_ADMIN
        }
      }),
      prisma.user.upsert({
        where: { email: 'admin@tsinghua.edu.cn' },
        update: {},
        create: {
          username: 'thuadmin',
          name: '清华管理员',
          phone: '13800000003',
          email: 'admin@tsinghua.edu.cn',
          password: hashedPassword,
          role: Role.SCHOOL_ADMIN
        }
      }),
      prisma.user.upsert({
        where: { email: 'admin@ruc.edu.cn' },
        update: {},
        create: {
          username: 'rucadmin',
          name: '人大管理员',
          phone: '13800000004',
          email: 'admin@ruc.edu.cn',
          password: hashedPassword,
          role: Role.SCHOOL_ADMIN
        }
      }),
      prisma.user.upsert({
        where: { email: 'admin@bnu.edu.cn' },
        update: {},
        create: {
          username: 'bnuadmin',
          name: '师大管理员',
          phone: '13800000005',
          email: 'admin@bnu.edu.cn',
          password: hashedPassword,
          role: Role.SCHOOL_ADMIN
        }
      }),
      prisma.user.upsert({
        where: { email: 'admin@bit.edu.cn' },
        update: {},
        create: {
          username: 'bitadmin',
          name: '理工管理员',
          phone: '13800000006',
          email: 'admin@bit.edu.cn',
          password: hashedPassword,
          role: Role.SCHOOL_ADMIN
        }
      }),
      prisma.user.upsert({
        where: { email: 'admin@buaa.edu.cn' },
        update: {},
        create: {
          username: 'buaaadmin',
          name: '航天管理员',
          phone: '13800000007',
          email: 'admin@buaa.edu.cn',
          password: hashedPassword,
          role: Role.SCHOOL_ADMIN
        }
      }),
      // 销售人员 - 不同学校和院系
      prisma.user.upsert({
        where: { email: 'marketer1@telecom.com' },
        update: {},
        create: {
          username: 'marketer001',
          name: '销售员张三',
          phone: '13900000001',
          email: 'marketer1@telecom.com',
          password: hashedPassword,
          role: Role.MARKETER
        }
      }),
      prisma.user.upsert({
        where: { email: 'marketer2@telecom.com' },
        update: {},
        create: {
          username: 'marketer002',
          name: '销售员李四',
          phone: '13900000002',
          email: 'marketer2@telecom.com',
          password: hashedPassword,
          role: Role.MARKETER
        }
      }),
      prisma.user.upsert({
        where: { email: 'marketer3@telecom.com' },
        update: {},
        create: {
          username: 'marketer003',
          name: '销售员王五',
          phone: '13900000003',
          email: 'marketer3@telecom.com',
          password: hashedPassword,
          role: Role.MARKETER
        }
      }),
      prisma.user.upsert({
        where: { email: 'marketer4@telecom.com' },
        update: {},
        create: {
          username: 'marketer004',
          name: '销售员赵六',
          phone: '13900000004',
          email: 'marketer4@telecom.com',
          password: hashedPassword,
          role: Role.MARKETER
        }
      }),
      prisma.user.upsert({
        where: { email: 'marketer5@telecom.com' },
        update: {},
        create: {
          username: 'marketer005',
          name: '销售员钱七',
          phone: '13900000005',
          email: 'marketer5@telecom.com',
          password: hashedPassword,
          role: Role.MARKETER
        }
      }),
      prisma.user.upsert({
        where: { email: 'marketer6@telecom.com' },
        update: {},
        create: {
          username: 'marketer006',
          name: '销售员孙八',
          phone: '13900000006',
          email: 'marketer6@telecom.com',
          password: hashedPassword,
          role: Role.MARKETER
        }
      })
    ]);
    console.log('✅ 扩展用户创建完成');

    // 4. 创建用户组织关系
    console.log('🔗 创建扩展用户组织关系...');
    const userOrgRelations = [
      // 超级管理员关联到超级管理员组
      { userId: users[0].id, organizationId: schools[0].id, role: Role.SUPER_ADMIN }, // 超级管理员组
      
      // 学校管理员关联
      { userId: users[1].id, organizationId: schools[1].id, role: Role.SCHOOL_ADMIN }, // 北大
      { userId: users[2].id, organizationId: schools[2].id, role: Role.SCHOOL_ADMIN }, // 清华
      { userId: users[3].id, organizationId: schools[3].id, role: Role.SCHOOL_ADMIN }, // 人大
      { userId: users[4].id, organizationId: schools[4].id, role: Role.SCHOOL_ADMIN }, // 师大
      { userId: users[5].id, organizationId: schools[5].id, role: Role.SCHOOL_ADMIN }, // 理工
      { userId: users[6].id, organizationId: schools[6].id, role: Role.SCHOOL_ADMIN }, // 航天
      
      // 销售员关联 - 只关联到学校
      { userId: users[7].id, organizationId: schools[1].id, role: Role.MARKETER }, // 销售员1：北大
      { userId: users[8].id, organizationId: schools[2].id, role: Role.MARKETER }, // 销售员2：清华
      
      // 销售员3：人大
      { userId: users[9].id, organizationId: schools[3].id, role: Role.MARKETER },
      
      // 销售员4：师大
      { userId: users[10].id, organizationId: schools[4].id, role: Role.MARKETER },
      
      // 销售员5：理工
      { userId: users[11].id, organizationId: schools[5].id, role: Role.MARKETER },
      
      // 销售员6：航天
      { userId: users[12].id, organizationId: schools[6].id, role: Role.MARKETER }
    ];
    
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
    console.log('✅ 扩展用户组织关系创建完成');

    // 5. 创建大量号码数据
    console.log('📱 创建大量号码数据...');
    const phoneNumbers = [];
    
    // 为每个院系创建更多号码
    for (let i = 0; i < departments.length; i++) {
      const dept = departments[i];
      const school = schools.find(s => s.id === dept.parentId);
      
      // 每个院系创建50个号码
      for (let j = 1; j <= 50; j++) {
        const phoneNumber = `138${String(i + 1).padStart(2, '0')}${String(j).padStart(6, '0')}`;
        const isPremium = j <= 10; // 前10个是靓号
        
        // 更复杂的状态分布
        let status;
        if (j <= 15) status = ReservationStatus.RESERVED;
        else if (j <= 25) status = ReservationStatus.PENDING_REVIEW;
        else status = ReservationStatus.UNRESERVED;
        
        const orderTime = status !== ReservationStatus.UNRESERVED ? 
          new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000) : null;
        
        phoneNumbers.push({
          phoneNumber,
          isPremium,
          premiumReason: isPremium ? (j <= 5 ? '连号' : '重复数字') : null,
          reservationStatus: status,
          orderTimestamp: orderTime,
          paymentAmount: status === ReservationStatus.RESERVED ? (isPremium ? 200 : 50) : null,
          paymentMethod: status === ReservationStatus.RESERVED ? 
            (j % 3 === 0 ? PaymentMethod.WECHAT : j % 3 === 1 ? PaymentMethod.ALIPAY : PaymentMethod.CASH) : null,
          transactionId: status === ReservationStatus.RESERVED ? `TXN${Date.now()}${i}${j}` : null,
          assignedMarketer: users[7 + (i % 6)].name, // 轮流分配6个销售员
          customerName: status !== ReservationStatus.UNRESERVED ? `客户${i + 1}-${j}` : null,
          customerContact: status !== ReservationStatus.UNRESERVED ? `customer${i}${j}@example.com` : null,
          shippingAddress: status === ReservationStatus.RESERVED ? `${school?.name}${dept.name}地址${j}号` : null,
          emsTrackingNumber: status === ReservationStatus.RESERVED && j <= 10 ? `EMS${Date.now()}${i}${j}` : null,
          deliveryStatus: status === ReservationStatus.RESERVED ? 
            (j <= 5 ? DeliveryStatus.RECEIVED_UNACTIVATED :
             j <= 8 ? DeliveryStatus.IN_TRANSIT_ACTIVATED :
             j <= 12 ? DeliveryStatus.IN_TRANSIT_UNACTIVATED :
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
    
    console.log('\n📊 扩展数据统计:');
    console.log(`学校: ${stats.schools} 个`);
    console.log(`院系: ${stats.departments} 个`);
    console.log(`用户: ${stats.users} 个`);
    console.log(`用户组织关系: ${stats.userOrganizations} 个`);
    console.log(`号码总数: ${stats.phoneNumbers} 个`);
    console.log(`已预订号码: ${stats.reservedNumbers} 个`);
    console.log(`待审核号码: ${stats.pendingNumbers} 个`);
    console.log(`靓号数量: ${stats.premiumNumbers} 个`);
    
    console.log('\n👥 扩展测试账号信息:');
    console.log('=== 管理员账号 ===');
    console.log('超级管理员: superadmin / admin@system.com / 123456');
    console.log('北大管理员: pkuadmin / admin@pku.edu.cn / 123456');
    console.log('清华管理员: thuadmin / admin@tsinghua.edu.cn / 123456');
    console.log('人大管理员: rucadmin / admin@ruc.edu.cn / 123456');
    console.log('师大管理员: bnuadmin / admin@bnu.edu.cn / 123456');
    console.log('理工管理员: bitadmin / admin@bit.edu.cn / 123456');
    console.log('航天管理员: buaaadmin / admin@buaa.edu.cn / 123456');
    
    console.log('\n=== 销售员账号 ===');
    console.log('销售员1(北大): marketer001 / marketer1@telecom.com / 123456');
    console.log('销售员2(清华): marketer002 / marketer2@telecom.com / 123456');
    console.log('销售员3(人大): marketer003 / marketer3@telecom.com / 123456');
    console.log('销售员4(师大): marketer004 / marketer4@telecom.com / 123456');
    console.log('销售员5(理工): marketer005 / marketer5@telecom.com / 123456');
    console.log('销售员6(航天): marketer006 / marketer6@telecom.com / 123456');
    
    console.log('\n🎉 扩展测试数据创建完成！');
    
  } catch (error) {
    console.error('❌ 创建扩展测试数据失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createExtendedTestData()
    .then(() => {
      console.log('扩展数据脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('扩展数据脚本执行失败:', error);
      process.exit(1);
    });
}

export { createExtendedTestData };