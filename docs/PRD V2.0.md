       
# 校园卡在线选号系统 - 产品需求文档 V2.0

**版本 V2.0-Production**

---

## 📋 版本更新说明

### V2.0 主要升级内容
- ✅ **多租户架构**：支持多学校、多院系的独立管理
- ✅ **组织层级管理**：完整的学校-院系二级组织架构
- ✅ **高级权限控制**：基于角色和组织的细粒度权限管理
- ✅ **增强的用户管理**：支持用户名登录、手机号验证
- ✅ **数据隔离与统计**：组织级别的数据隔离和统计分析
- ✅ **API权限中间件**：完整的API级别权限控制

---

## 1. 项目概述

### 1.1. 项目背景

随着业务规模的扩大，原有的单租户系统已无法满足多学校、多院系的独立管理需求。V2.0版本在保持原有核心功能的基础上，全面升级为**多租户架构**，支持：

- **多学校独立运营**：每个学校拥有独立的管理权限和数据空间
- **院系级别管理**：支持学校下设多个院系的分级管理
- **数据隔离与安全**：确保不同组织间的数据完全隔离
- **统一平台管理**：超级管理员可统一管理所有组织

### 1.2. 产品目标

- **🏢 组织化管理**：建立完整的学校-院系二级组织架构，支持分级管理
- **🔐 精细化权限**：基于角色和组织的多维度权限控制体系
- **📊 数据驱动决策**：提供组织级别的数据统计和分析能力
- **🚀 可扩展架构**：支持无限扩展学校和院系数量
- **🛡️ 企业级安全**：完整的身份认证、权限控制和数据隔离

### 1.3. 目标用户

- **客户 (C端用户)**：寻求办理校园卡的学生群体
- **销售人员 (MARKETER)**：负责特定组织的订单跟进和客户服务
- **学校管理员 (SCHOOL_ADMIN)**：管理整个学校及其下属院系
- **超级管理员 (SUPER_ADMIN)**：系统最高权限，管理所有组织和用户

---

## 2. 用户角色与权限体系

### 2.1. 角色定义

| 角色 | 英文标识 | 权限范围 | 核心职责 |
|------|----------|----------|----------|
| **超级管理员** | SUPER_ADMIN | 全系统 | 管理所有组织、用户和系统配置 |
| **学校管理员** | SCHOOL_ADMIN | 所属学校及下属院系 | 管理学校级别的用户、号码和订单 |
| **销售人员** | MARKETER | 分配的组织范围 | 处理订单、跟进客户、管理号码 |

### 2.2. 权限矩阵

| 功能模块 | 超级管理员 | 学校管理员 | 销售人员 |
|----------|------------|------------|----------|
| **组织管理** | ✅ 全部 | ✅ 所属学校 | ❌ 只读 |
| **用户管理** | ✅ 全部 | ✅ 所属组织 | ❌ 无权限 |
| **号码管理** | ✅ 全部 | ✅ 所属组织 | ✅ 分配范围 |
| **订单管理** | ✅ 全部 | ✅ 所属组织 | ✅ 分配范围 |
| **数据导入导出** | ✅ 全部 | ✅ 所属组织 | ❌ 无权限 |
| **系统统计** | ✅ 全部 | ✅ 所属组织 | ✅ 分配范围 |

### 2.3. 组织权限继承规则

- **学校管理员**：自动拥有其学校下所有院系的管理权限
- **销售人员**：可分配到多个组织，但需要院系权限时必须同时拥有对应学校权限
- **数据隔离**：用户只能访问其有权限的组织数据

---

## 3. 核心功能模块

### 3.1. 客户端功能 (C-Side) - 保持不变

**3.1.1. 号码展示页**
- 响应式网格布局，支持PC和移动端
- 无限滚动加载，每页100个号码
- 号码状态标识（可选/靓号/已锁定）
- "一键屏蔽已选号码"开关
- 智能搜索和一键复制功能

**3.1.2. 选号与下单流程**
- 选择号码 → 弹出下单窗口 → 填写信息 → 提交订单
- 数据库事务确保并发安全
- 支付方式选择（20元定金/200元全款）

### 3.2. 多租户管理后台 (B-Side) - 全新升级

**3.2.1. 组织层级管理**

- **组织架构可视化**：
  - 树形结构展示学校-院系层级关系
  - 支持组织的创建、编辑、删除
  - 组织描述和基本信息管理

- **组织统计面板**：
  ```typescript
  interface OrganizationStats {
    userCount: number;        // 用户数量
    numberCount: number;      // 号码总数
    availableNumbers: number; // 可选号码
    pendingReview: number;    // 待审核订单
  }
  ```

**3.2.2. 高级用户管理**

- **用户创建与编辑**：
  - 支持用户名、姓名、手机号、邮箱
  - 密码加密存储
  - 角色分配和权限控制

- **用户组织关系管理**：
  - 可视化的组织分配界面
  - 自动验证权限合理性
  - 批量用户组织分配

**3.2.3. 智能权限控制**

- **API级别权限中间件**：
  ```typescript
  // 权限检查示例
  export function withAuth(handler, {
    requiredRole?: Role[];
    resourceType?: 'phone_number' | 'organization' | 'user';
    action?: 'read' | 'write' | 'delete';
  })
  ```

- **数据过滤机制**：
  - 自动根据用户权限过滤数据
  - 支持学校-院系级联权限
  - 缓存机制提升性能

**3.2.4. 增强的订单管理**

- **多维度订单视图**：
  - 按组织筛选订单
  - 实时订单状态更新
  - 批量操作支持

- **权限边界控制**：
  - 用户只能查看有权限的订单
  - 跨组织操作自动拦截

---

## 4. 数据模型升级

### 4.1. 新增核心表结构

**Organization 组织表**
```sql
CREATE TABLE Organization (
  id          String   PRIMARY KEY,
  name        String   NOT NULL,
  type        OrgType  NOT NULL, -- 'SCHOOL' | 'DEPARTMENT'
  description String,
  parentId    String,  -- 父级组织ID
  createdAt   DateTime DEFAULT now(),
  updatedAt   DateTime DEFAULT now()
);
```

**UserOrganization 用户组织关系表**
```sql
CREATE TABLE UserOrganization (
  id             String PRIMARY KEY,
  userId         String NOT NULL,
  organizationId String NOT NULL,
  role           Role   NOT NULL,
  createdAt      DateTime DEFAULT now(),
  updatedAt      DateTime DEFAULT now(),
  UNIQUE(userId, organizationId)
);
```

### 4.2. 升级的PhoneNumber表
```sql
ALTER TABLE PhoneNumber ADD COLUMN schoolId String;
ALTER TABLE PhoneNumber ADD COLUMN departmentId String;
-- 添加组织关联外键
```

### 4.3. 增强的User表
```sql
ALTER TABLE User ADD COLUMN username String UNIQUE;
ALTER TABLE User ADD COLUMN phone String UNIQUE NOT NULL;
ALTER TABLE User MODIFY COLUMN email String; -- 改为可选
```

---

## 5. API架构升级

### 5.1. 新增API端点

**组织管理API**
- `GET /api/admin/organizations` - 获取组织列表
- `GET /api/admin/organizations/hierarchy` - 获取组织层级
- `POST /api/admin/organizations` - 创建组织
- `PUT /api/admin/organizations/[id]` - 更新组织
- `DELETE /api/admin/organizations/[id]` - 删除组织

**用户管理API**
- `GET /api/admin/users` - 获取用户列表（支持分页）
- `POST /api/admin/users` - 创建用户
- `PUT /api/admin/users/[id]` - 更新用户
- `DELETE /api/admin/users/[id]` - 删除用户

**用户组织关系API**
- `GET /api/admin/user-organizations` - 获取用户组织关系
- `POST /api/admin/user-organizations` - 分配用户组织
- `DELETE /api/admin/user-organizations/[id]` - 移除用户组织关系

**统计信息API**
- `GET /api/admin/stats` - 获取系统统计信息
- `GET /api/admin/stats/organizations` - 获取组织统计信息

### 5.2. 权限中间件架构

```typescript
// 权限检查流程
1. 验证用户身份 (getUserPermissions)
2. 检查角色权限 (requiredRole)
3. 验证资源权限 (checkResourcePermission)
4. 应用数据过滤 (getUserDataFilter)
5. 执行业务逻辑
```

---

## 6. 技术架构升级

### 6.1. 前端技术栈
- **Next.js 15+**：App Router + Server Components
- **React 18+**：现代化Hooks和状态管理
- **TypeScript**：全面类型安全
- **Tailwind CSS**：响应式设计
- **Prisma Client**：类型安全的数据库操作

### 6.2. 后端技术栈
- **Next.js API Routes**：RESTful API实现
- **NextAuth.js**：身份认证和会话管理
- **Prisma ORM**：数据库操作和迁移
- **SQLite/PostgreSQL**：数据存储

### 6.3. 核心技术特性
- **多租户架构**：完整的数据隔离和权限控制
- **缓存机制**：请求级别的权限和数据缓存
- **并发安全**：数据库事务和乐观锁
- **API权限控制**：中间件级别的权限验证
- **类型安全**：端到端的TypeScript类型检查

---

## 7. 部署与运维升级

### 7.1. 环境变量配置
```bash
# 数据库配置
DATABASE_URL="sqlite:./prisma/dev.db"

# 认证配置
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# 应用配置
NODE_ENV="production"
PORT=3000

# 多租户配置
ENABLE_MULTI_TENANT=true
DEFAULT_ORG_ID="default-org"
```

### 7.2. 数据库迁移
```bash
# 升级到V2.0数据结构
npx prisma migrate deploy

# 初始化组织数据
npm run seed:organizations

# 迁移现有用户到组织架构
npm run migrate:users-to-orgs
```

---

## 8. 性能与安全

### 8.1. 性能优化
- **请求级缓存**：权限和数据过滤结果缓存
- **数据库索引**：组织关联字段优化
- **分页加载**：大数据量的分页处理
- **API响应优化**：减少不必要的数据传输

### 8.2. 安全增强
- **多层权限验证**：API、数据库、UI三层权限控制
- **数据隔离**：组织级别的完全数据隔离
- **输入验证**：全面的参数验证和SQL注入防护
- **会话管理**：安全的JWT令牌和会话控制

---

## 9. 测试与质量保证

### 9.1. 自动化测试
- **多租户API测试**：完整的权限边界测试
- **组织权限测试**：跨组织访问控制验证
- **数据隔离测试**：确保数据不会泄露
- **性能测试**：大规模数据下的性能验证

### 9.2. 测试覆盖
- ✅ 用户认证和权限控制
- ✅ 组织层级管理
- ✅ 数据过滤和隔离
- ✅ API权限边界
- ✅ 并发安全性

---

## 10. 后续版本规划

### 10.1. V2.1 计划
- **高级数据分析**：组织级别的业务报表和图表
- **操作审计日志**：完整的用户操作记录和追踪
- **批量操作优化**：支持更大规模的数据批量处理
- **移动端优化**：管理后台的移动端适配

### 10.2. V2.2 愿景
- **工作流引擎**：可配置的订单审批流程
- **消息通知系统**：邮件、短信、站内消息集成
- **第三方集成**：支付接口、物流接口集成
- **多语言支持**：国际化和本地化支持

### 10.3. V3.0 展望
- **微服务架构**：服务拆分和容器化部署
- **实时协作**：WebSocket实时数据同步
- **AI智能推荐**：基于用户行为的号码推荐
- **区块链溯源**：订单和支付的区块链记录

---

## 📊 系统能力对比

| 功能特性 | V1.0 | V2.0 |
|----------|------|------|
| **架构模式** | 单租户 | 多租户 |
| **组织管理** | ❌ | ✅ 学校-院系二级 |
| **用户角色** | 3种 | 3种（权限增强） |
| **权限控制** | 基础 | 多维度精细化 |
| **数据隔离** | ❌ | ✅ 组织级隔离 |
| **API权限** | 简单 | 中间件级控制 |
| **扩展性** | 有限 | 无限扩展 |
| **安全性** | 基础 | 企业级 |

---

**文档版本：** V2.0-Production  
**最后更新：** 2025年1月  
**系统状态：** 已部署生产环境，多租户架构稳定运行  
**升级建议：** 建议从V1.0平滑升级到V2.0，享受多租户架构带来的管理效率提升
        