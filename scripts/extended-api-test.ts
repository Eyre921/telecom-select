import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ExtendedTestUser {
  email: string;
  password: string;
  role: string;
  name: string;
  description: string;
  school?: string;
  department?: string;
}

interface TestResult {
  testName: string;
  success: boolean;
  details?: string;
  errorMessage?: string;
  timestamp: Date;
  responseTime?: number;
  statusCode?: number;
  responseData?: any;
}

interface ExtendedTestReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
    timestamp: string;
    testCategories: Record<string, { passed: number; total: number }>;
  };
  testResults: TestResult[];
  failedTests: TestResult[];
  userTests: Record<string, TestResult[]>;
  apiCoverage: {
    totalEndpoints: number;
    testedEndpoints: number;
    coverage: number;
    endpointDetails: Record<string, { tested: boolean; methods: string[] }>;
  };
  performanceMetrics: {
    averageResponseTime: number;
    slowestEndpoint: { endpoint: string; time: number };
    fastestEndpoint: { endpoint: string; time: number };
  };
}

class ExtendedAPITester {
  private baseUrl: string;
  private testResults: TestResult[] = [];
  private authenticatedClients: Map<string, AxiosInstance> = new Map();
  private startTime: Date;
  private extendedTestUsers: ExtendedTestUser[];
  private testedEndpoints: Set<string> = new Set();

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.startTime = new Date();
    
    // 扩展的测试用户列表
    this.extendedTestUsers = [
      {
        email: 'admin@system.com',
        password: '123456',
        role: 'SUPER_ADMIN',
        name: '系统管理员',
        description: '超级管理员，拥有所有权限'
      },
      {
        email: 'admin@pku.edu.cn',
        password: '123456',
        role: 'SCHOOL_ADMIN',
        name: '北大管理员',
        description: '北京大学校级管理员',
        school: '北京大学'
      },
      {
        email: 'admin@tsinghua.edu.cn',
        password: '123456',
        role: 'SCHOOL_ADMIN',
        name: '清华管理员',
        description: '清华大学校级管理员',
        school: '清华大学'
      },
      {
        email: 'admin@ruc.edu.cn',
        password: '123456',
        role: 'SCHOOL_ADMIN',
        name: '人大管理员',
        description: '中国人民大学校级管理员',
        school: '中国人民大学'
      },
      {
        email: 'admin@bnu.edu.cn',
        password: '123456',
        role: 'SCHOOL_ADMIN',
        name: '师大管理员',
        description: '北京师范大学校级管理员',
        school: '北京师范大学'
      },
      {
        email: 'admin@bit.edu.cn',
        password: '123456',
        role: 'SCHOOL_ADMIN',
        name: '理工管理员',
        description: '北京理工大学校级管理员',
        school: '北京理工大学'
      },
      {
        email: 'admin@buaa.edu.cn',
        password: '123456',
        role: 'SCHOOL_ADMIN',
        name: '航天管理员',
        description: '北京航空航天大学校级管理员',
        school: '北京航空航天大学'
      },
      {
        email: 'marketer1@telecom.com',
        password: '123456',
        role: 'MARKETER',
        name: '销售员张三',
        description: '北京大学销售人员',
        school: '北京大学',
        department: '计算机学院'
      },
      {
        email: 'marketer2@telecom.com',
        password: '123456',
        role: 'MARKETER',
        name: '销售员李四',
        description: '清华大学销售人员',
        school: '清华大学',
        department: '软件学院'
      },
      {
        email: 'marketer3@telecom.com',
        password: '123456',
        role: 'MARKETER',
        name: '销售员王五',
        description: '中国人民大学销售人员',
        school: '中国人民大学',
        department: '信息学院'
      },
      {
        email: 'marketer4@telecom.com',
        password: '123456',
        role: 'MARKETER',
        name: '销售员赵六',
        description: '北京师范大学销售人员',
        school: '北京师范大学',
        department: '心理学院'
      },
      {
        email: 'marketer5@telecom.com',
        password: '123456',
        role: 'MARKETER',
        name: '销售员钱七',
        description: '北京理工大学销售人员',
        school: '北京理工大学',
        department: '机械工程学院'
      },
      {
        email: 'marketer6@telecom.com',
        password: '123456',
        role: 'MARKETER',
        name: '销售员孙八',
        description: '北京航空航天大学销售人员',
        school: '北京航空航天大学',
        department: '航空学院'
      }
    ];
  }

  private logResult(testName: string, success: boolean, details?: string, errorMessage?: string, responseTime?: number, statusCode?: number, responseData?: any) {
    const result: TestResult = {
      testName,
      success,
      details,
      errorMessage,
      timestamp: new Date(),
      responseTime,
      statusCode,
      responseData
    };
    
    this.testResults.push(result);
    
    const status = success ? '✅' : '❌';
    const timeInfo = responseTime ? ` (${responseTime}ms)` : '';
    const statusInfo = statusCode ? ` [${statusCode}]` : '';
    
    console.log(`${status} ${testName}${timeInfo}${statusInfo}`);
    if (details) console.log(`   📝 ${details}`);
    if (errorMessage) console.log(`   ⚠️  ${errorMessage}`);
  }

  private async resetDatabase() {
    console.log('🔄 重置数据库并创建扩展测试数据...');
    try {
      // 重置数据库
      await execAsync('npx prisma migrate reset --force', { cwd: process.cwd() });
      console.log('✅ 数据库重置完成');
      
      // 运行扩展种子数据
      console.log('🌱 运行扩展种子数据...');
      await execAsync('npx tsx scripts/extended-seed-data.ts', { cwd: process.cwd() });
      console.log('✅ 扩展种子数据创建完成');
      
      // 等待一段时间确保数据库操作完成
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error: any) {
      console.error('❌ 数据库重置失败:', error.message);
      throw error;
    }
  }

  private async createAuthenticatedClient(user: ExtendedTestUser): Promise<AxiosInstance> {
    const jar = new CookieJar();
    const client = wrapper(axios.create({
      baseURL: this.baseUrl,
      jar,
      timeout: 15000,
      validateStatus: () => true
    }));
  
    try {
      // 1. 获取 CSRF token
      const csrfResponse = await client.get('/api/auth/csrf');
      const csrfToken = csrfResponse.data.csrfToken;
      
      // 2. 使用正确的 NextAuth credentials provider 登录方式
      const loginData = new URLSearchParams({
        email: user.email,
        password: user.password,
        csrfToken: csrfToken,
        callbackUrl: `${this.baseUrl}/admin/dashboard`,
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
        this.logResult(`Authentication - ${user.role} (${user.school || 'System'})`, true, `User ${user.email} authenticated successfully`);
        return client;
      }
      
      throw new Error(`Login failed - Status: ${signinResponse.status}`);
      
    } catch (error: any) {
      this.logResult(`Authentication - ${user.role} (${user.school || 'System'})`, false, undefined, `Failed to authenticate ${user.email}: ${error.message}`);
      throw error;
    }
  }

  private async testApiEndpoint(
    client: AxiosInstance | null,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    testName: string,
    data?: any,
    expectedStatus?: number,
    category: string = 'General'
  ): Promise<{ success: boolean; data?: any; status?: number }> {
    const startTime = Date.now();
    this.testedEndpoints.add(`${method} ${endpoint}`);
    
    try {
      const axiosClient = client || axios.create({ baseURL: this.baseUrl, timeout: 15000 });
      
      let response;
      switch (method) {
        case 'GET':
          const params = data ? new URLSearchParams(data).toString() : '';
          const url = params ? `${endpoint}?${params}` : endpoint;
          response = await axiosClient.get(url);
          break;
        case 'POST':
          response = await axiosClient.post(endpoint, data);
          break;
        case 'PUT':
          response = await axiosClient.put(endpoint, data);
          break;
        case 'DELETE':
          response = await axiosClient.delete(endpoint);
          break;
      }
      
      const responseTime = Date.now() - startTime;
      const success = expectedStatus ? response.status === expectedStatus : response.status < 400;
      
      this.logResult(
        `[${category}] ${testName}`,
        success,
        success ? `${method} ${endpoint} - Response received` : undefined,
        !success ? `Expected status ${expectedStatus || 'success'}, got ${response.status}` : undefined,
        responseTime,
        response.status,
        response.data
      );
      
      return {
        success,
        data: response.data,
        status: response.status
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const status = error.response?.status;
      const success = expectedStatus ? status === expectedStatus : false;
      
      this.logResult(
        `[${category}] ${testName}`,
        success,
        success ? `Expected error status ${expectedStatus}` : undefined,
        !success ? `${method} ${endpoint} failed: ${error.message}` : undefined,
        responseTime,
        status
      );
      
      return {
        success,
        status
      };
    }
  }

  async runExtendedTests(): Promise<ExtendedTestReport> {
    console.log('🚀 开始扩展API测试...');
    console.log(`📍 测试目标: ${this.baseUrl}`);
    console.log(`⏰ 开始时间: ${this.startTime.toLocaleString()}`);
    console.log(`👥 测试用户数量: ${this.extendedTestUsers.length}`);
    
    try {
      // 0. 数据重置
      console.log('\n=== 0. 数据重置 ===');
      await this.resetDatabase();
      
      // 1. 服务器连接测试
      console.log('\n=== 1. 服务器连接测试 ===');
      await this.testApiEndpoint(null, 'GET', '/', 'Server Connectivity', undefined, undefined, 'Infrastructure');
      
      // 2. 公共API测试
      console.log('\n=== 2. 公共API测试 ===');
      await this.testApiEndpoint(null, 'GET', '/api/numbers', 'Public - Phone Numbers List', undefined, undefined, 'Public API');
      await this.testApiEndpoint(null, 'GET', '/api/numbers?hideReserved=true', 'Public - Filtered Numbers (Hide Reserved)', undefined, undefined, 'Public API');
      await this.testApiEndpoint(null, 'GET', '/api/numbers?page=2', 'Public - Paginated Numbers', undefined, undefined, 'Public API');
      await this.testApiEndpoint(null, 'GET', '/api/auth/csrf', 'Auth - CSRF Token', undefined, undefined, 'Authentication');
      await this.testApiEndpoint(null, 'GET', '/api/auth/session', 'Auth - Session Check', undefined, undefined, 'Authentication');
      
      // 3. 用户认证测试
      console.log('\n=== 3. 扩展用户认证测试 ===');
      for (const user of this.extendedTestUsers) {
        try {
          const client = await this.createAuthenticatedClient(user);
          this.authenticatedClients.set(`${user.role}-${user.email}`, client);
        } catch (error) {
          // 错误已在createAuthenticatedClient中记录
        }
      }
      
      // 4. 管理员API全面测试
      console.log('\n=== 4. 管理员API全面测试 ===');
      for (const [userKey, client] of this.authenticatedClients) {
        const user = this.extendedTestUsers.find(u => userKey.includes(u.email));
        if (!user) continue;
        
        console.log(`\n--- 测试 ${user.role} (${user.school || 'System'}) 权限 ---`);
        
        // 基础管理API
        await this.testApiEndpoint(client, 'GET', '/api/admin/stats', `Admin Stats - ${user.role}`, undefined, undefined, 'Admin API');
        await this.testApiEndpoint(client, 'GET', '/api/admin/numbers', `Admin Numbers List - ${user.role}`, undefined, undefined, 'Admin API');
        await this.testApiEndpoint(client, 'GET', '/api/admin/organizations', `Admin Organizations - ${user.role}`, undefined, undefined, 'Admin API');
        await this.testApiEndpoint(client, 'GET', '/api/admin/pending-orders', `Admin Pending Orders - ${user.role}`, undefined, undefined, 'Admin API');
        
        // 带参数的API测试
        await this.testApiEndpoint(client, 'GET', '/api/admin/numbers', `Admin Numbers with Search - ${user.role}`, { search: '138', page: '1', limit: '10' }, undefined, 'Admin API');
        await this.testApiEndpoint(client, 'GET', '/api/admin/organizations', `Admin Organizations by Type - ${user.role}`, { type: 'SCHOOL' }, undefined, 'Admin API');
        
        // 超级管理员专属功能
        if (user.role === 'SUPER_ADMIN') {
          await this.testApiEndpoint(client, 'POST', '/api/admin/actions', `Admin Actions - Clear Numbers - ${user.role}`, {
            action: 'CLEAR_ALL_NUMBERS',
            payload: {}
          }, undefined, 'Admin Actions');
          
          await this.testApiEndpoint(client, 'POST', '/api/admin/actions', `Admin Actions - Ban Prefix - ${user.role}`, {
            action: 'BAN_PREFIX',
            payload: { prefix: '138' }
          }, undefined, 'Admin Actions');
          
          await this.testApiEndpoint(client, 'POST', '/api/admin/actions', `Admin Actions - Unban Prefix - ${user.role}`, {
            action: 'UNBAN_PREFIX',
            payload: { prefix: '138' }
          }, undefined, 'Admin Actions');
        }
        
        // 释放超时订单
        await this.testApiEndpoint(client, 'POST', '/api/admin/release-overdue', `Release Overdue Orders - ${user.role}`, {}, undefined, 'Admin API');
      }
      
      // 5. 权限边界测试
      console.log('\n=== 5. 权限边界测试 ===');
      const marketerClients = Array.from(this.authenticatedClients.entries())
        .filter(([key]) => key.includes('MARKETER'))
        .slice(0, 3); // 测试前3个销售员
      
      for (const [userKey, client] of marketerClients) {
        const user = this.extendedTestUsers.find(u => userKey.includes(u.email));
        if (!user) continue;
        
        // 销售人员尝试访问超级管理员功能
        await this.testApiEndpoint(client, 'POST', '/api/admin/actions', `Permission Boundary - ${user.name} accessing SUPER_ADMIN`, {
          action: 'CLEAR_ALL_NUMBERS',
          payload: {}
        }, 403, 'Permission Boundary');
        
        // 销售人员尝试访问其他学校数据
        const otherSchoolId = user.school === '北京大学' ? 'school-2' : 'school-1';
        await this.testApiEndpoint(client, 'GET', '/api/admin/numbers', `Cross-School Data Access - ${user.name}`, {
          schoolId: otherSchoolId
        }, undefined, 'Permission Boundary');
      }
      
      // 6. 数据导入测试
      console.log('\n=== 6. 数据导入测试 ===');
      const superAdminClient = this.authenticatedClients.get('SUPER_ADMIN-admin@system.com');
      if (superAdminClient) {
        // 测试格式一 (table1) - 号码\t卡板状态\t收款金额\t客户姓名\t工作人员
        const table1Data = `19067192804\t已预定\t全款200\t罗焱阳\t符航康\n19067192814\t已预定\t全款200\t李晓蕾\t王晓阳\n19067192824\t\t\t\t\n19067192834\t已预定\t定金20\t常栩康\t符航康`;
        
        await this.testApiEndpoint(superAdminClient, 'POST', '/api/admin/import-data', 'Data Import - Format 1 (Table1)', {
          data: table1Data,
          type: 'table1',
          schoolId: 'school-1',
          departmentId: 'dept-1'
        }, undefined, 'Data Import');
        
        // 测试格式二 (table2) - 序号\t客户姓名\t新选号码\t新选号码序号\t联系号码\t邮寄地址\t快递单号
        const table2Data = `1\t张乐怡\t19067172615\t294\t13873195044\t湖南省长沙市雨花区万家丽南路27号芙佳花园\t9879616972620\n2\t许仕杰\t19067172095\t10\t13787030565\t湖南省长沙市雨花区左家塘曙光大邸4栋1339\t9879616904980`;
        
        await this.testApiEndpoint(superAdminClient, 'POST', '/api/admin/import-data', 'Data Import - Format 2 (Table2)', {
          data: table2Data,
          type: 'table2',
          schoolId: 'school-1',
          departmentId: 'dept-1'
        }, undefined, 'Data Import');
        
        // 测试智能分割功能 - 包含地址换行的数据
        const smartSplitData = `1\t张乐怡\t19067172615\t294\t13873195044\t湖南省长沙市雨花区万家丽南路27号\n芙佳花园\t9879616972620\n2\t许仕杰\t19067172095\t10\t13787030565\t湖南省长沙市雨花区左家塘\n曙光大邸4栋1339\t9879616904980`;
        
        await this.testApiEndpoint(superAdminClient, 'POST', '/api/admin/import-data', 'Data Import - Smart Split with Address Newlines', {
          data: smartSplitData,
          type: 'table2',
          schoolId: 'school-1',
          departmentId: 'dept-1'
        }, undefined, 'Data Import');
        
        // 测试无效数据导入
        await this.testApiEndpoint(superAdminClient, 'POST', '/api/admin/import-data', 'Data Import - Invalid Data', {
          data: 'invalid data without proper format',
          type: 'table1',
          schoolId: 'school-1'
        }, 400, 'Data Import');
        
        // 测试缺少必要参数
        await this.testApiEndpoint(superAdminClient, 'POST', '/api/admin/import-data', 'Data Import - Missing School ID', {
          data: table1Data,
          type: 'table1'
        }, 400, 'Data Import');
      }
      
      // 7. 错误处理和边界测试
      console.log('\n=== 7. 错误处理和边界测试 ===');
      await this.testApiEndpoint(null, 'GET', '/api/nonexistent', 'Error Handling - 404 Not Found', undefined, 404, 'Error Handling');
      await this.testApiEndpoint(null, 'GET', '/api/admin/stats', 'Error Handling - Unauthorized Admin Access', undefined, 401, 'Error Handling');
      await this.testApiEndpoint(null, 'POST', '/api/admin/stats', 'Error Handling - Method Not Allowed', {}, 405, 'Error Handling');
      
      // 测试无效参数 - 修复期望状态码
      await this.testApiEndpoint(null, 'GET', '/api/numbers', 'Error Handling - Invalid Page Parameter', { page: 'invalid' }, 400, 'Error Handling');
      
      // 8. 并发测试
      console.log('\n=== 8. 并发测试 ===');
      await this.runConcurrentTests();
      
      // 9. 性能测试
      console.log('\n=== 9. 性能测试 ===');
      await this.runPerformanceTests();
      
    } catch (error: any) {
      console.error('❌ 测试执行失败:', error.message);
      this.logResult('Test Execution', false, undefined, error.message);
    }
    
    return this.generateExtendedReport();
  }

  private async runConcurrentTests() {
    const concurrentPromises = [];
    
    // 同时发送多个请求测试并发处理
    for (let i = 0; i < 5; i++) {
      concurrentPromises.push(
        this.testApiEndpoint(null, 'GET', '/api/numbers', `Concurrent Test ${i + 1}`, { page: i + 1 }, undefined, 'Concurrency')
      );
    }
    
    await Promise.all(concurrentPromises);
  }

  private async runPerformanceTests() {
    // 大数据量查询测试
    await this.testApiEndpoint(null, 'GET', '/api/numbers', 'Performance - Large Dataset Query', { limit: '100' }, undefined, 'Performance');
    
    // 复杂查询测试
    const superAdminClient = this.authenticatedClients.get('SUPER_ADMIN-admin@system.com');
    if (superAdminClient) {
      await this.testApiEndpoint(superAdminClient, 'GET', '/api/admin/numbers', 'Performance - Complex Admin Query', {
        search: '138',
        page: '1',
        limit: '50',
        sort: JSON.stringify({ field: 'phoneNumber', direction: 'asc' })
      }, undefined, 'Performance');
    }
  }

  private generateExtendedReport(): ExtendedTestReport {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();
    const passed = this.testResults.filter(r => r.success).length;
    const failed = this.testResults.filter(r => !r.success).length;
    const failedTests = this.testResults.filter(r => !r.success);
    
    // 按用户角色分组测试结果
    const userTests: Record<string, TestResult[]> = {};
    this.testResults.forEach(result => {
      const roleMatch = result.testName.match(/- (SUPER_ADMIN|SCHOOL_ADMIN|MARKETER)/);;
      if (roleMatch) {
        const role = roleMatch[1];
        if (!userTests[role]) userTests[role] = [];
        userTests[role].push(result);
      }
    });
    
    // 按测试类别分组
    const testCategories: Record<string, { passed: number; total: number }> = {};
    this.testResults.forEach(result => {
      const categoryMatch = result.testName.match(/\[([^\]]+)\]/);
      const category = categoryMatch ? categoryMatch[1] : 'General';
      
      if (!testCategories[category]) {
        testCategories[category] = { passed: 0, total: 0 };
      }
      
      testCategories[category].total++;
      if (result.success) {
        testCategories[category].passed++;
      }
    });
    
    // 计算性能指标
    const responseTimes = this.testResults
      .filter(r => r.responseTime)
      .map(r => ({ endpoint: r.testName, time: r.responseTime! }));
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, r) => sum + r.time, 0) / responseTimes.length 
      : 0;
    
    const slowestEndpoint = responseTimes.length > 0 
      ? responseTimes.reduce((max, r) => r.time > max.time ? r : max)
      : { endpoint: 'N/A', time: 0 };
    
    const fastestEndpoint = responseTimes.length > 0 
      ? responseTimes.reduce((min, r) => r.time < min.time ? r : min)
      : { endpoint: 'N/A', time: 0 };
    
    // API覆盖率统计
    const allEndpoints = [
      'GET /', 'GET /api/numbers', 'GET /api/auth/csrf', 'GET /api/auth/session',
      'GET /api/admin/stats', 'GET /api/admin/numbers', 'GET /api/admin/organizations',
      'GET /api/admin/pending-orders', 'POST /api/admin/actions', 'POST /api/admin/release-overdue',
      'POST /api/admin/import-data'
    ];
    
    const endpointDetails: Record<string, { tested: boolean; methods: string[] }> = {};
    allEndpoints.forEach(endpoint => {
      const [method, path] = endpoint.split(' ');
      if (!endpointDetails[path]) {
        endpointDetails[path] = { tested: false, methods: [] };
      }
      endpointDetails[path].methods.push(method);
      if (this.testedEndpoints.has(endpoint)) {
        endpointDetails[path].tested = true;
      }
    });
    
    const testedEndpointsCount = Object.values(endpointDetails).filter(e => e.tested).length;
    const coverage = (testedEndpointsCount / Object.keys(endpointDetails).length) * 100;
    
    const report: ExtendedTestReport = {
      summary: {
        total: this.testResults.length,
        passed,
        failed,
        duration,
        timestamp: endTime.toISOString(),
        testCategories
      },
      testResults: this.testResults,
      failedTests,
      userTests,
      apiCoverage: {
        totalEndpoints: Object.keys(endpointDetails).length,
        testedEndpoints: testedEndpointsCount,
        coverage: Math.round(coverage * 100) / 100,
        endpointDetails
      },
      performanceMetrics: {
        averageResponseTime: Math.round(averageResponseTime * 100) / 100,
        slowestEndpoint,
        fastestEndpoint
      }
    };
    
    this.printExtendedReport(report);
    this.saveExtendedJsonReport(report);
    
    return report;
  }

  private printExtendedReport(report: ExtendedTestReport) {
    console.log('\n' + '='.repeat(100));
    console.log('📊 扩展API测试报告总结');
    console.log('='.repeat(100));
    console.log(`📈 总测试数: ${report.summary.total}`);
    console.log(`✅ 通过: ${report.summary.passed}`);
    console.log(`❌ 失败: ${report.summary.failed}`);
    console.log(`📊 成功率: ${((report.summary.passed / report.summary.total) * 100).toFixed(2)}%`);
    console.log(`⏱️  总耗时: ${(report.summary.duration / 1000).toFixed(2)}秒`);
    console.log(`🎯 API覆盖率: ${report.apiCoverage.coverage}% (${report.apiCoverage.testedEndpoints}/${report.apiCoverage.totalEndpoints})`);
    
    console.log('\n📊 按测试类别统计:');
    Object.entries(report.summary.testCategories).forEach(([category, stats]) => {
      const percentage = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(`   ${category}: ${stats.passed}/${stats.total} (${percentage}%)`);
    });
    
    console.log('\n⚡ 性能指标:');
    console.log(`   平均响应时间: ${report.performanceMetrics.averageResponseTime}ms`);
    console.log(`   最慢端点: ${report.performanceMetrics.slowestEndpoint.endpoint} (${report.performanceMetrics.slowestEndpoint.time}ms)`);
    console.log(`   最快端点: ${report.performanceMetrics.fastestEndpoint.endpoint} (${report.performanceMetrics.fastestEndpoint.time}ms)`);
    
    if (report.failedTests.length > 0) {
      console.log('\n❌ 失败的测试:');
      report.failedTests.forEach(test => {
        console.log(`   • ${test.testName}: ${test.errorMessage}`);
      });
    }
    
    console.log('\n👥 按角色分组的测试结果:');
    Object.entries(report.userTests).forEach(([role, tests]) => {
      const rolePassed = tests.filter(t => t.success).length;
      const roleTotal = tests.length;
      console.log(`   ${role}: ${rolePassed}/${roleTotal} (${((rolePassed/roleTotal)*100).toFixed(1)}%)`);
    });
    
    console.log('\n🎯 扩展测试用户信息:');
    console.log('=== 管理员账号 ===');
    this.extendedTestUsers.filter(u => u.role.includes('ADMIN')).forEach(user => {
      console.log(`   • ${user.role} (${user.school || 'System'}): ${user.email}`);
    });
    
    console.log('\n=== 销售员账号 ===');
    this.extendedTestUsers.filter(u => u.role === 'MARKETER').forEach(user => {
      console.log(`   • ${user.name} (${user.school}/${user.department}): ${user.email}`);
    });
    
    console.log('\n' + '='.repeat(100));
  }

  private saveExtendedJsonReport(report: ExtendedTestReport) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const jsonReportPath = path.join(process.cwd(), `extended-api-test-report-${timestamp}.json`);
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
    console.log(`📄 扩展测试报告已保存: ${jsonReportPath}`);
  }
}

// 主执行函数
async function main() {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
  const tester = new ExtendedAPITester(baseUrl);
  
  try {
    const report = await tester.runExtendedTests();
    
    // 根据测试结果设置退出码
    const exitCode = report.summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ 扩展测试执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export { ExtendedAPITester };