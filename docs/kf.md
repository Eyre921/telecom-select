# 校园卡在线选号系统 - 开发文档 V2.0

**版本：** V2.0-Production  
**创建时间：** 2025年1月  
**技术栈：** Next.js 15 + TypeScript + Prisma + SQLite + NextAuth.js  
**架构模式：** 多租户架构

---

## 1. 项目概述

### 1.1 技术架构升级

本项目V2.0版本采用现代化的多租户全栈Web开发技术栈：

- **前端框架：** Next.js 15 (App Router)
- **开发语言：** TypeScript 5+
- **样式框架：** Tailwind CSS 4
- **数据库ORM：** Prisma 6.13.0
- **数据库：** SQLite (生产环境可切换PostgreSQL)
- **身份认证：** NextAuth.js 4.24.11
- **权限管理：** 基于角色和组织的多维度权限控制
- **多租户架构：** 组织级数据隔离
- **部署方式：** PM2 + Standalone模式

### 1.2 项目结构

```
telecom-select-system/
├── prisma/                           # 数据库相关
│   ├── schema.prisma                # 数据库模型定义（多租户架构）
│   ├── dev.db                      # SQLite数据库文件
│   └── migrations/                 # 数据库迁移文件
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                   # API路由
│   │   │   ├── admin/             # 管理员API（多租户）
│   │   │   │   ├── organizations/ # 组织管理API
│   │   │   │   ├── users/         # 用户管理API
│   │   │   │   ├── user-organizations/ # 用户组织关系API
│   │   │   │   ├── stats/         # 统计信息API
│   │   │   │   └── numbers/       # 号码管理API
│   │   │   ├── auth/              # 身份认证API
│   │   │   ├── numbers/           # 号码查询API
│   │   │   ├── orders/            # 订单管理API
│   │   │   └── register/          # 用户注册API
│   │   ├── admin/                 # 管理后台页面
│   │   │   ├── dashboard/         # 多租户仪表盘
│   │   │   ├── users/             # 用户管理页面
│   │   │   └── import/            # 数据导入页面
│   │   ├── signin/                # 登录页面
│   │   └── page.tsx               # 客户端首页
│   ├── components/                # React组件
│   │   ├── admin/                 # 管理后台组件
│   │   │   ├── MultiTenantDashboard.tsx    # 多租户仪表盘
│   │   │   ├── OrganizationHierarchy.tsx   # 组织层级管理
│   │   │   ├── SchoolSelector.tsx          # 学校选择器
│   │   │   ├── UserOrganizationModal.tsx   # 用户组织分配
│   │   │   └── StatsCards.tsx              # 统计卡片
│   │   ├── ui/                    # 通用UI组件
│   │   └── providers/             # Context提供者
│   ├── lib/                       # 工具库
│   │   ├── auth.ts                # 认证配置
│   │   ├── permissions.ts         # 权限管理核心
│   │   ├── organization.ts        # 组织管理工具
│   │   ├── prisma.ts              # 数据库连接
│   │   └── utils.ts               # 工具函数
│   └── types/                     # TypeScript类型定义
├── scripts/                       # 脚本文件
│   └── multi-tenant-api-test.ts   # 多租户API测试脚本
├── multi-tenant-test-reports/     # 测试报告
└── package.json                   # 项目依赖
```

---

## 2. 多租户架构设计

### 2.1 数据库设计（多租户模型）

#### 2.1.1 核心表结构

**Organization 表（组织表）**

参考文件：<mcfile name="schema.prisma" path="prisma/schema.prisma"></mcfile>

```typescript
model Organization {
  id          String      @id @default(cuid())
  name        String
  type        OrgType     // SCHOOL | DEPARTMENT
  description String?
  parentId    String?     // 支持层级结构
  parent      Organization? @relation("OrganizationHierarchy", fields: [parentId], references: [id])
  children    Organization[] @relation("OrganizationHierarchy")
  
  // 关联关系
  userOrganizations UserOrganization[]
  phoneNumbers      PhoneNumber[]
  
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}
```

**UserOrganization 表（用户组织关系表）**

```typescript
model UserOrganization {
  id             String       @id @default(cuid())
  userId         String
  organizationId String
  role           Role         // 在该组织中的角色
  
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  
  @@unique([userId, organizationId])
}
```

**PhoneNumber 表（号码表 - 支持组织隔离）**

```typescript
model PhoneNumber {
  id                String             @id @default(cuid())
  phoneNumber       String             @unique
  organizationId    String?            // 组织隔离
  organization      Organization?      @relation(fields: [organizationId], references: [id])
  
  // 业务字段保持不变
  isPremium         Boolean            @default(false)
  reservationStatus ReservationStatus  @default(UNRESERVED)
  // ... 其他字段
}
```

#### 2.1.2 枚举类型

```typescript
enum OrgType {
  SCHOOL      // 学校
  DEPARTMENT  // 院系
}

enum Role {
  SUPER_ADMIN  // 超级管理员
  SCHOOL_ADMIN // 学校管理员
  MARKETER     // 销售员
}
```

### 2.2 权限管理系统

#### 2.2.1 权限控制核心

参考文件：<mcfile name="permissions.ts" path="src/lib/permissions.ts"></mcfile>

```typescript
// 权限结果接口
interface PermissionResult {
  hasPermission: boolean;
  organizations: Organization[];
  role: Role;
  userId: string;
}

// 数据过滤条件
interface DataFilter {
  organizationIds?: string[];
  canAccessAll?: boolean;
}

// 获取用户权限
export async function getUserPermissions(userId: string): Promise<PermissionResult>

// 获取数据过滤条件
export async function getUserDataFilter(userId: string): Promise<DataFilter>

// 权限验证中间件
export function withAuth(handler: Function, requiredRole?: Role)
```

#### 2.2.2 组织权限检查

```typescript
// 检查组织访问权限
export async function checkOrganizationPermission(
  userId: string, 
  organizationId: string
): Promise<boolean>

// 检查号码访问权限
export async function checkPhoneNumberPermission(
  userId: string, 
  phoneNumberId: string
): Promise<boolean>
```

---

## 3. API接口设计（多租户）

### 3.1 组织管理API

#### 3.1.1 组织层级API

**GET /api/admin/organizations/hierarchy**
- 功能：获取组织层级结构
- 权限：根据用户角色返回相应的组织数据
- 实现：<mcfile name="route.ts" path="src/app/api/admin/organizations/hierarchy/route.ts"></mcfile>

**GET /api/admin/organizations**
- 功能：获取组织列表
- 参数：`type` (SCHOOL|DEPARTMENT)
- 权限：基于用户组织权限过滤

#### 3.1.2 用户组织关系API

**POST /api/admin/user-organizations**
- 功能：分配用户到组织
- 参数：`userId`, `organizationIds[]`, `role`
- 权限：仅超级管理员和学校管理员

**GET /api/admin/user-organizations**
- 功能：获取用户组织关系
- 权限：基于当前用户权限过滤

### 3.2 统计信息API

**GET /api/admin/stats**
- 功能：获取系统统计信息
- 返回：基于用户权限的组织级统计
- 实现：<mcfile name="route.ts" path="src/app/api/admin/stats/route.ts"></mcfile>

```typescript
// 统计信息结构
interface SystemStats {
  totalNumbers: number;
  availableNumbers: number;
  pendingReview: number;
  todayOrders: number;
  organizationStats?: OrganizationStats[];
}
```

### 3.3 用户管理API

**POST /api/admin/users**
- 功能：创建用户
- 权限：超级管理员可创建任意用户，学校管理员只能创建本校用户
- 实现：<mcfile name="route.ts" path="src/app/api/admin/users/route.ts"></mcfile>

**GET /api/admin/users**
- 功能：获取用户列表
- 过滤：基于当前用户的组织权限

---

## 4. 前端组件架构（多租户）

### 4.1 多租户仪表盘

#### 4.1.1 多租户仪表盘组件

参考文件：<mcfile name="MultiTenantDashboard.tsx" path="src/components/admin/MultiTenantDashboard.tsx"></mcfile>

```typescript
interface OrganizationStats {
  userCount: number;
  numberCount: number;
  availableNumbers: number;
  pendingReview: number;
}

interface MultiTenantDashboardProps {
  organizations: Organization[];
  stats: Record<string, OrganizationStats>;
}
```

#### 4.1.2 组织层级管理

参考文件：<mcfile name="OrganizationHierarchy.tsx" path="src/components/admin/OrganizationHierarchy.tsx"></mcfile>

- 树形结构显示学校-院系层级
- 支持展开/折叠
- 显示各组织统计信息

#### 4.1.3 学校选择器

参考文件：<mcfile name="SchoolSelector.tsx" path="src/components/admin/SchoolSelector.tsx"></mcfile>

- 根据用户权限显示可访问的学校
- 支持切换当前管理的学校

### 4.2 用户管理组件

#### 4.2.1 用户组织分配

参考文件：<mcfile name="UserOrganizationModal.tsx" path="src/components/admin/UserOrganizationModal.tsx"></mcfile>

- 为用户分配组织和角色
- 支持多选组织
- 权限验证

---

## 5. 部署与运维

### 5.1 环境配置

```bash
# .env.local
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secret-key"
```

### 5.2 数据库迁移

```bash
# 生成迁移文件
npx prisma migrate dev --name add_multi_tenant_support

# 应用迁移
npx prisma migrate deploy

# 生成客户端
npx prisma generate
```

### 5.3 PM2部署配置

参考文件：<mcfile name="ecosystem.config.js" path="ecosystem.config.js"></mcfile>

```javascript
module.exports = {
  apps: [{
    name: 'telecom-app',
    script: 'server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

---

## 6. 测试与质量保证

### 6.1 多租户API测试

参考文件：<mcfile name="multi-tenant-api-test.ts" path="scripts/multi-tenant-api-test.ts"></mcfile>

测试覆盖：
- 认证功能测试
- 组织层级API测试
- 用户管理API测试
- 权限控制测试
- 数据隔离测试

### 6.2 测试报告

测试报告存储在：<mcfolder name="multi-tenant-test-reports" path="multi-tenant-test-reports"></mcfolder>

- HTML格式报告：可视化测试结果
- JSON格式报告：详细测试数据
- 自动化测试：支持CI/CD集成

---

## 7. 性能优化

### 7.1 数据库优化

```sql
-- 组织相关索引
CREATE INDEX idx_user_organizations_user_id ON UserOrganization(userId);
CREATE INDEX idx_user_organizations_org_id ON UserOrganization(organizationId);
CREATE INDEX idx_phone_numbers_org_id ON PhoneNumber(organizationId);
```

### 7.2 权限缓存

```typescript
// 使用AsyncLocalStorage缓存权限信息
const requestCache = new AsyncLocalStorage<Map<string, any>>();

export function getCachedPermissions(userId: string) {
  const cache = requestCache.getStore();
  return cache?.get(`permissions_${userId}`);
}
```

---

## 8. 安全性

### 8.1 数据隔离

- 组织级数据隔离
- 基于用户权限的数据过滤
- API级别的权限验证

### 8.2 权限验证

```typescript
// API路由权限验证示例
export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, 'SCHOOL_ADMIN');
  if (!authResult.hasPermission) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  
  // 基于用户权限过滤数据
  const dataFilter = await getUserDataFilter(authResult.userId);
  // ...
}
```

---

## 9. 故障排除

### 9.1 权限问题

```bash
# 检查用户组织关系
npx prisma studio
# 查看 UserOrganization 表

# 重置用户权限
node scripts/reset-user-permissions.js
```

### 9.2 数据隔离问题

```bash
# 验证数据隔离
node scripts/verify-data-isolation.js

# 修复组织关联
node scripts/fix-organization-relations.js
```

---

## 10. 版本升级指南

### 10.1 从V1.0升级到V2.0

1. **数据库迁移**
   ```bash
   npx prisma migrate deploy
   ```

2. **数据迁移脚本**
   ```bash
   node scripts/migrate-to-multi-tenant.js
   ```

3. **权限初始化**
   ```bash
   node scripts/init-organizations.js
   ```

### 10.2 配置更新

- 更新环境变量
- 重新配置PM2
- 更新Nginx配置（如适用）

---

**文档版本：** V2.0-Production  
**最后更新：** 2025年1月  
**系统状态：** 多租户架构已部署生产环境  
**技术支持：** 如有技术问题，请参考相关源码文件或联系开发团队
        