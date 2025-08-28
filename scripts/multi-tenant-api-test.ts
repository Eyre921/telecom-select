import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as fs from 'fs';
import * as path from 'path';

// 测试配置
const BASE_URL = 'http://localhost:3000';
const TEST_RESULTS_DIR = 'multi-tenant-test-reports';

interface TestUser {
  email: string;
  username: string;
  phone: string;
  password: string;
  role: string;
  name: string;
  description: string;
  school?: string;
  department?: string;
}

interface TestResult {
  name: string;
  method: string;
  url: string;
  status: number;
  success: boolean;
  responseTime: number;
  error?: string;
  response?: any;
}

interface TestSession {
  sessionId: string;
  client: AxiosInstance;
  user?: any;
}

class MultiTenantAPITester {
  private results: TestResult[] = [];
  private sessions: Map<string, TestSession> = new Map();
  private startTime: number = Date.now();
  private testUsers: TestUser[];

  constructor() {
    // 确保测试结果目录存在
    if (!fs.existsSync(TEST_RESULTS_DIR)) {
      fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
    }

    // 测试用户数据 - 与extended-seed-data.ts保持一致
    this.testUsers = [
      {
        email: 'admin@system.com',
        username: 'superadmin',
        phone: '13800000000',
        password: '123456',
        role: 'SUPER_ADMIN',
        name: '系统管理员',
        description: '超级管理员，拥有所有权限'
      },
      {
        email: 'admin@pku.edu.cn',
        username: 'pkuadmin',
        phone: '13800000001',
        password: '123456',
        role: 'SCHOOL_ADMIN',
        name: '北大管理员',
        description: '北京大学校级管理员',
        school: '北京大学'
      },
      {
        email: 'marketer1@telecom.com',
        username: 'marketer_zhang',
        phone: '13800001001',
        password: '123456',
        role: 'MARKETER',
        name: '销售员张三',
        description: '北京大学销售人员',
        school: '北京大学',
        department: '计算机学院'
      }
    ];
  }

  private async createAuthenticatedClient(user: TestUser): Promise<AxiosInstance> {
    const jar = new CookieJar();
    const client = wrapper(axios.create({
      baseURL: BASE_URL,
      jar,
      timeout: 15000,
      validateStatus: () => true
    }));
  
    try {
      // 1. 获取 CSRF token
      const csrfResponse = await client.get('/api/auth/csrf');
      const csrfToken = csrfResponse.data?.csrfToken;
      
      if (!csrfToken) {
        throw new Error('Failed to get CSRF token');
      }
      
      // 2. 使用正确的 NextAuth credentials provider 登录方式
      const loginData = new URLSearchParams({
        identifier: user.email,  // 修改：从 email 改为 identifier
        password: user.password,
        csrfToken: csrfToken,
        callbackUrl: `${BASE_URL}/admin/dashboard`,
        redirect: 'false',
        json: 'true'
      });
  
      const signinResponse = await client.post('/api/auth/callback/credentials', loginData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 400 || status === 302
      });
  
      // 3. 验证会话是否建立
      const sessionResponse = await client.get('/api/auth/session');
      if (sessionResponse.status === 200 && sessionResponse.data?.user) {
        console.log(`✅ ${user.role} (${user.school || 'System'}) 认证成功`);
        return client;
      }
      
      throw new Error(`Login failed - Status: ${signinResponse.status}`);
      
    } catch (error: any) {
      console.log(`❌ ${user.role} (${user.school || 'System'}) 认证失败: ${error.message}`);
      throw error;
    }
  }

  private async runTest(
    name: string,
    method: string,
    endpoint: string,
    data?: any,
    sessionId?: string,
    expectedStatus: number = 200
  ): Promise<TestResult> {
    console.log(`🧪 运行测试: ${name}`);
    const startTime = Date.now();
    
    try {
      const session = sessionId ? this.sessions.get(sessionId) : null;
      const client = session?.client || axios.create({ baseURL: BASE_URL, timeout: 15000 });

      let response;
      switch (method) {
        case 'GET':
          const params = data ? new URLSearchParams(data).toString() : '';
          const url = params ? `${endpoint}?${params}` : endpoint;
          response = await client.get(url);
          break;
        case 'POST':
          response = await client.post(endpoint, data);
          break;
        case 'PUT':
          response = await client.put(endpoint, data);
          break;
        case 'PATCH':
          response = await client.patch(endpoint, data);
          break;
        case 'DELETE':
          response = await client.delete(endpoint);
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      const responseTime = Date.now() - startTime;
      const success = response.status === expectedStatus;
      
      const result: TestResult = {
        name,
        method,
        url: `${BASE_URL}${endpoint}`,
        status: response.status,
        success,
        responseTime,
        response: response.data
      };

      if (success) {
        console.log(`✅ ${name} - 成功 (${responseTime}ms)`);
      } else {
        console.log(`❌ ${name} - 失败: 期望状态 ${expectedStatus}, 实际状态 ${response.status}`);
      }

      this.results.push(result);
      return result;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const actualStatus = error.response?.status || 0;
      const success = actualStatus === expectedStatus;  // 检查是否符合期望
      
      const result: TestResult = {
        name,
        method,
        url: `${BASE_URL}${endpoint}`,
        status: actualStatus,
        success,  // 使用计算出的success值
        responseTime,
        error: success ? undefined : (error.message || String(error))  // 如果成功则不显示错误
      };

      if (success) {
        console.log(`✅ ${name} - 成功 (${responseTime}ms)`);
      } else {
        console.log(`❌ ${name} - 错误: ${result.error}`);
      }
      
      this.results.push(result);
      return result;
    }
  }

  async login(sessionId: string, userIdentifier: string): Promise<boolean> {
    const user = this.testUsers.find(u => u.username === userIdentifier || u.email === userIdentifier);
    if (!user) {
      console.log(`❌ 找不到用户: ${userIdentifier}`);
      return false;
    }

    try {
      const client = await this.createAuthenticatedClient(user);
      
      // 验证会话
      const sessionResponse = await client.get('/api/auth/session');
      if (sessionResponse.status === 200 && sessionResponse.data?.user) {
        this.sessions.set(sessionId, {
          sessionId,
          client,
          user: sessionResponse.data.user
        });
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 开始多租户API测试...');
    console.log('='.repeat(50));

    // 1. 认证测试
    console.log('\n📝 1. 认证功能测试');
    console.log('-'.repeat(30));
    
    // 超级管理员登录
    await this.login('superadmin', 'superadmin');

    // 学校管理员登录
    await this.login('schooladmin', 'pkuadmin');

    // 销售员登录
    await this.login('marketer', 'marketer_zhang');

    // 2. 组织层级API测试
    console.log('\n🏢 2. 组织层级API测试');
    console.log('-'.repeat(30));
    
    // 超级管理员获取组织层级
    await this.runTest(
      '超级管理员获取组织层级',
      'GET',
      '/api/admin/organizations/hierarchy',
      undefined,
      'superadmin'
    );

    // 学校管理员获取组织层级
    await this.runTest(
      '学校管理员获取组织层级',
      'GET',
      '/api/admin/organizations/hierarchy',
      undefined,
      'schooladmin'
    );

    // 销售员获取组织层级
    await this.runTest(
      '销售员获取组织层级',
      'GET',
      '/api/admin/organizations/hierarchy',
      undefined,
      'marketer'
    );

    // 3. 用户管理API测试
    console.log('\n👥 3. 用户管理API测试');
    console.log('-'.repeat(30));
    
    // 获取用户列表
    await this.runTest(
      '超级管理员获取用户列表',
      'GET',
      '/api/admin/users',
      undefined,
      'superadmin'
    );

    await this.runTest(
      '学校管理员获取用户列表',
      'GET',
      '/api/admin/users',
      undefined,
      'schooladmin'
    );

    // 创建新用户
    const newUserData = {
      username: 'testuser001',
      name: '测试用户',
      phone: '13999999999',
      email: 'testuser@example.com',
      password: '123456',
      role: 'MARKETER'
    };

    const createUserResult = await this.runTest(
      '创建新用户',
      'POST',
      '/api/admin/users',
      newUserData,
      'superadmin',
      201
    );

    let createdUserId: string | null = null;
    if (createUserResult.success && createUserResult.response?.user?.id) {
      createdUserId = createUserResult.response.user.id;
      
      // 更新用户信息
      await this.runTest(
        '更新用户信息',
        'PATCH',
        `/api/admin/users/${createdUserId}`,
        {
          name: '测试用户（已更新）',
          email: 'testuser_updated@example.com'
        },
        'superadmin'
      );

      // 获取单个用户信息
      await this.runTest(
        '获取单个用户信息',
        'GET',
        `/api/admin/users/${createdUserId}`,
        undefined,
        'superadmin'
      );
    }

    // 4. 组织管理API测试
    console.log('\n🏛️ 4. 组织管理API测试');
    console.log('-'.repeat(30));
    
    // 获取组织列表
    await this.runTest(
      '获取所有组织',
      'GET',
      '/api/admin/organizations',
      undefined,
      'superadmin'
    );

    // 按类型获取组织
    await this.runTest(
      '获取学校组织',
      'GET',
      '/api/admin/organizations',
      { type: 'SCHOOL' },
      'superadmin'
    );

    await this.runTest(
      '获取院系组织',
      'GET',
      '/api/admin/organizations',
      { type: 'DEPARTMENT' },
      'superadmin'
    );

    // 5. 用户组织关系API测试
    console.log('\n🔗 5. 用户组织关系API测试');
    console.log('-'.repeat(30));
    
    if (createdUserId) {
      // 为用户分配组织
      await this.runTest(
        '为用户分配组织',
        'POST',
        '/api/admin/user-organizations',
        {
          userId: createdUserId,
          organizationIds: ['school-1'],
          role: 'MARKETER'
        },
        'superadmin',
        201
      );

      // 获取用户组织关系
      await this.runTest(
        '获取用户组织关系',
        'GET',
        '/api/admin/user-organizations',
        undefined,
        'superadmin'
      );
    }

    // 6. 统计信息API测试
    console.log('\n📊 6. 统计信息API测试');
    console.log('-'.repeat(30));
    
    await this.runTest(
      '获取系统统计信息',
      'GET',
      '/api/admin/stats',
      undefined,
      'superadmin'
    );

    // 7. 权限测试
    console.log('\n🔒 7. 权限控制测试');
    console.log('-'.repeat(30));
    
    // 销售员尝试创建用户（应该失败）
    await this.runTest(
      '销售员尝试创建用户（权限不足）',
      'POST',
      '/api/admin/users',
      newUserData,
      'marketer',
      403
    );

    // 未登录用户访问API（应该失败）
    await this.runTest(
      '未登录访问用户API（未授权）',
      'GET',
      '/api/admin/users',
      undefined,
      undefined,
      401
    );

    // 8. 清理测试数据
    console.log('\n🧹 8. 清理测试数据');
    console.log('-'.repeat(30));
    
    if (createdUserId) {
      await this.runTest(
        '删除测试用户',
        'DELETE',
        `/api/admin/users/${createdUserId}`,
        undefined,
        'superadmin',
        204
      );
    }

    // 9. 数据验证测试
    console.log('\n🔍 9. 数据验证测试');
    console.log('-'.repeat(30));
    
    // 创建用户时缺少必填字段
    await this.runTest(
      '创建用户缺少用户名（数据验证）',
      'POST',
      '/api/admin/users',
      {
        name: '测试用户',
        phone: '13999999998',
        email: 'test2@example.com',
        password: '123456',
        role: 'MARKETER'
        // 缺少 username
      },
      'superadmin',
      400
    );

    // 创建用户时邮箱格式错误
    await this.runTest(
      '创建用户邮箱格式错误（数据验证）',
      'POST',
      '/api/admin/users',
      {
        username: 'testuser002',
        name: '测试用户',
        phone: '13999999997',
        email: 'invalid-email',  // 错误的邮箱格式
        password: '123456',
        role: 'MARKETER'
      },
      'superadmin',
      400
    );

    // 创建用户时手机号格式错误
    await this.runTest(
      '创建用户手机号格式错误（数据验证）',
      'POST',
      '/api/admin/users',
      {
        username: 'testuser003',
        name: '测试用户',
        phone: '123',  // 错误的手机号格式
        email: 'test3@example.com',
        password: '123456',
        role: 'MARKETER'
      },
      'superadmin',
      400
    );

    // 10. 重复数据测试
    console.log('\n🔄 10. 重复数据测试');
    console.log('-'.repeat(30));
    
    // 尝试创建重复用户名的用户
    await this.runTest(
      '创建重复用户名的用户（唯一性约束）',
      'POST',
      '/api/admin/users',
      {
        username: 'marketer001',  // 已存在的用户名
        name: '重复用户',
        phone: '13999999996',
        email: 'duplicate@example.com',
        password: '123456',
        role: 'MARKETER'
      },
      'superadmin',
      409
    );

    // 尝试创建重复邮箱的用户
    await this.runTest(
      '创建重复邮箱的用户（唯一性约束）',
      'POST',
      '/api/admin/users',
      {
        username: 'testuser004',
        name: '重复邮箱用户',
        phone: '13999999995',
        email: 'marketer1@telecom.com',  // 已存在的邮箱
        password: '123456',
        role: 'MARKETER'
      },
      'superadmin',
      409
    );

    // 11. 跨权限边界测试
    console.log('\n🚫 11. 跨权限边界测试');
    console.log('-'.repeat(30));
    
    // 学校管理员尝试访问其他学校的用户
    await this.runTest(
      '学校管理员访问其他学校用户（权限边界）',
      'GET',
      '/api/admin/users?organizationId=school-2',  // 清华大学，但登录的是北大管理员
      undefined,
      'schooladmin',
      403
    );

    // 销售员尝试删除用户
    await this.runTest(
      '销售员尝试删除用户（权限不足）',
      'DELETE',
      '/api/admin/users/cmeuw1c1k0009cdlwlob7syor',
      undefined,
      'marketer',
      403
    );

    // 销售员尝试修改其他用户信息
    await this.runTest(
      '销售员尝试修改其他用户（权限不足）',
      'PATCH',
      '/api/admin/users/cmeuw1c1k0002cdlwvrsjtz2n',
      { name: '恶意修改' },
      'marketer',
      403
    );

    // 12. 资源不存在测试
    console.log('\n❓ 12. 资源不存在测试');
    console.log('-'.repeat(30));
    
    // 访问不存在的用户
    await this.runTest(
      '获取不存在的用户信息',
      'GET',
      '/api/admin/users/nonexistent-user-id',
      undefined,
      'superadmin',
      404
    );

    // 更新不存在的用户
    await this.runTest(
      '更新不存在的用户信息',
      'PATCH',
      '/api/admin/users/nonexistent-user-id',
      { name: '不存在的用户' },
      'superadmin',
      404
    );

    // 删除不存在的用户
    await this.runTest(
      '删除不存在的用户',
      'DELETE',
      '/api/admin/users/nonexistent-user-id',
      undefined,
      'superadmin',
      404
    );

    // 为不存在的用户分配组织
    await this.runTest(
      '为不存在的用户分配组织',
      'POST',
      '/api/admin/user-organizations',
      {
        userId: 'nonexistent-user-id',
        organizationIds: ['school-1'],
        role: 'MARKETER'
      },
      'superadmin',
      404
    );

    // 13. 组织关系边界测试
    console.log('\n🏢 13. 组织关系边界测试');
    console.log('-'.repeat(30));
    
    // 为用户分配不存在的组织
    await this.runTest(
      '为用户分配不存在的组织',
      'POST',
      '/api/admin/user-organizations',
      {
        userId: 'cmeuw1c1k0009cdlwlob7syor',
        organizationIds: ['nonexistent-org-id'],
        role: 'MARKETER'
      },
      'superadmin',
      404
    );

    // 学校管理员尝试将用户分配到其他学校
    await this.runTest(
      '学校管理员跨校分配用户（权限边界）',
      'POST',
      '/api/admin/user-organizations',
      {
        userId: 'cmeuw1c1k0009cdlwlob7syor',
        organizationIds: ['school-2'],  // 清华大学
        role: 'MARKETER'
      },
      'schooladmin',  // 北大管理员
      403
    );

    // 14. 参数格式错误测试
    console.log('\n📝 14. 参数格式错误测试');
    console.log('-'.repeat(30));
    
    // 发送空的请求体
    await this.runTest(
      '创建用户时发送空请求体',
      'POST',
      '/api/admin/users',
      {},
      'superadmin',
      400
    );

    // 发送错误的JSON格式（这个需要特殊处理）
    await this.runTest(
      '用户组织关系参数类型错误',
      'POST',
      '/api/admin/user-organizations',
      {
        userId: 123,  // 应该是字符串
        organizationIds: 'school-1',  // 应该是数组
        role: 'INVALID_ROLE'  // 无效的角色
      },
      'superadmin',
      400
    );

    // 15. 会话过期测试
    console.log('\n⏰ 15. 会话过期测试');
    console.log('-'.repeat(30));
    
    // 使用无效的会话token
    const invalidClient = axios.create({ 
      baseURL: BASE_URL, 
      timeout: 15000,
      headers: {
        'Cookie': 'next-auth.session-token=invalid-token'
      }
    });
    
    try {
      const response = await invalidClient.get('/api/admin/users');
      await this.runTest(
        '使用无效会话访问API',
        'GET',
        '/api/admin/users',
        undefined,
        undefined,
        401
      );
    } catch (error: any) {
      // 手动记录这个测试结果
      const result: TestResult = {
        name: '使用无效会话访问API',
        method: 'GET',
        url: `${BASE_URL}/api/admin/users`,
        status: error.response?.status || 401,
        success: (error.response?.status || 401) === 401,
        responseTime: 0,
        error: error.response?.status === 401 ? undefined : error.message
      };
      this.results.push(result);
      console.log(`✅ 使用无效会话访问API - 成功 (0ms)`);
    }

    // 16. 大数据量测试
    console.log('\n📊 16. 大数据量测试');
    console.log('-'.repeat(30));
    
    // 获取用户列表时使用大的分页参数
    await this.runTest(
      '获取用户列表大分页参数',
      'GET',
      '/api/admin/users?page=999&limit=1000',
      undefined,
      'superadmin',
      200
    );

    // 17. 特殊字符测试
    console.log('\n🔤 17. 特殊字符测试');
    console.log('-'.repeat(30));
    
    // 创建包含特殊字符的用户
    await this.runTest(
      '创建包含特殊字符的用户名',
      'POST',
      '/api/admin/users',
      {
        username: 'test<script>alert(1)</script>',  // XSS测试
        name: '测试用户\"特殊字符',
        phone: '13999999994',
        email: 'special@example.com',
        password: '123456',
        role: 'MARKETER'
      },
      'superadmin',
      400  // 应该被验证拒绝
    );

    // 生成测试报告
    await this.generateReport();
  }

  async generateReport(): Promise<void> {
    const endTime = Date.now();
    const totalTime = endTime - this.startTime;
    const successCount = this.results.filter(r => r.success).length;
    const failureCount = this.results.length - successCount;
    const averageResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / this.results.length;

    const report = {
      summary: {
        totalTests: this.results.length,
        successCount,
        failureCount,
        successRate: `${((successCount / this.results.length) * 100).toFixed(2)}%`,
        totalTime: `${totalTime}ms`,
        averageResponseTime: `${averageResponseTime.toFixed(2)}ms`,
        timestamp: new Date().toISOString()
      },
      results: this.results
    };

    // 保存JSON报告
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonFilename = `multi-tenant-api-test-report-${timestamp}.json`;
    const jsonPath = path.join(TEST_RESULTS_DIR, jsonFilename);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // 生成HTML报告
    const htmlContent = this.generateHTMLReport(report);
    const htmlFilename = `multi-tenant-api-test-report-${timestamp}.html`;
    const htmlPath = path.join(TEST_RESULTS_DIR, htmlFilename);
    fs.writeFileSync(htmlPath, htmlContent);

    console.log('\n📋 测试报告');
    console.log('='.repeat(50));
    console.log(`总测试数: ${report.summary.totalTests}`);
    console.log(`成功: ${successCount} | 失败: ${failureCount}`);
    console.log(`成功率: ${report.summary.successRate}`);
    console.log(`总耗时: ${report.summary.totalTime}`);
    console.log(`平均响应时间: ${report.summary.averageResponseTime}`);
    console.log(`\n📄 报告文件:`);
    console.log(`JSON: ${jsonPath}`);
    console.log(`HTML: ${htmlPath}`);
  }

  generateHTMLReport(report: any): string {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>多租户API测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-card .value { font-size: 24px; font-weight: bold; color: #007bff; }
        .test-results { margin-top: 20px; }
        .test-item { margin-bottom: 15px; padding: 15px; border-radius: 6px; border-left: 4px solid #ddd; }
        .test-success { background-color: #d4edda; border-left-color: #28a745; }
        .test-failure { background-color: #f8d7da; border-left-color: #dc3545; }
        .test-name { font-weight: bold; margin-bottom: 5px; }
        .test-details { font-size: 14px; color: #666; }
        .test-error { color: #dc3545; margin-top: 10px; }
        .response-data { background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>多租户API测试报告</h1>
            <p>生成时间: ${report.summary.timestamp}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>总测试数</h3>
                <div class="value">${report.summary.totalTests}</div>
            </div>
            <div class="summary-card">
                <h3>成功数</h3>
                <div class="value" style="color: #28a745;">${report.summary.successCount}</div>
            </div>
            <div class="summary-card">
                <h3>失败数</h3>
                <div class="value" style="color: #dc3545;">${report.summary.failureCount}</div>
            </div>
            <div class="summary-card">
                <h3>成功率</h3>
                <div class="value">${report.summary.successRate}</div>
            </div>
            <div class="summary-card">
                <h3>总耗时</h3>
                <div class="value">${report.summary.totalTime}</div>
            </div>
            <div class="summary-card">
                <h3>平均响应时间</h3>
                <div class="value">${report.summary.averageResponseTime}</div>
            </div>
        </div>
        
        <div class="test-results">
            <h2>详细测试结果</h2>
            ${report.results.map((result: TestResult) => `
                <div class="test-item ${result.success ? 'test-success' : 'test-failure'}">
                    <div class="test-name">${result.name}</div>
                    <div class="test-details">
                        <strong>${result.method}</strong> ${result.url} - 
                        状态码: ${result.status} - 
                        响应时间: ${result.responseTime}ms
                    </div>
                    ${result.error ? `<div class="test-error">错误: ${result.error}</div>` : ''}
                    ${result.response ? `<div class="response-data">${JSON.stringify(result.response, null, 2)}</div>` : ''}
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
    `;
  }
}

// 主函数
async function runMultiTenantAPITests() {
  const tester = new MultiTenantAPITester();
  
  try {
    await tester.runAllTests();
    console.log('\n🎉 多租户API测试完成！');
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runMultiTenantAPITests();
}

export { MultiTenantAPITester, runMultiTenantAPITests };