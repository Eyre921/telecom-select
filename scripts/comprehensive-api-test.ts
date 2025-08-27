import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestUser {
  email: string;
  password: string;
  role: string;
  name: string;
  description: string;
}

interface TestResult {
  testName: string;
  success: boolean;
  details?: string;
  errorMessage?: string;
  timestamp: Date;
  responseTime?: number;
  statusCode?: number;
}

interface TestReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
    timestamp: string;
  };
  testResults: TestResult[];
  failedTests: TestResult[];
  userTests: Record<string, TestResult[]>;
  apiCoverage: {
    totalEndpoints: number;
    testedEndpoints: number;
    coverage: number;
  };
}

class ComprehensiveAPITester {
  private baseUrl: string;
  private testResults: TestResult[] = [];
  private authenticatedClients: Map<string, AxiosInstance> = new Map();
  private startTime: Date;
  private testUsers: TestUser[];

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.startTime = new Date();
    
    // 使用种子数据中的真实测试用户
    this.testUsers = [
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
        description: '北京大学校级管理员'
      },
      {
        email: 'marketer1@telecom.com',
        password: '123456',
        role: 'MARKETER',
        name: '销售员张三',
        description: '北京大学销售人员'
      }
    ];
  }

  private logResult(testName: string, success: boolean, details?: string, errorMessage?: string, responseTime?: number, statusCode?: number) {
    const result: TestResult = {
      testName,
      success,
      details,
      errorMessage,
      timestamp: new Date(),
      responseTime,
      statusCode
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
    console.log('🔄 重置数据库...');
    try {
      // 重置数据库
      await execAsync('npx prisma migrate reset --force', { cwd: process.cwd() });
      console.log('✅ 数据库重置完成');
      
      // 运行种子数据
      console.log('🌱 运行种子数据...');
      await execAsync('npx tsx scripts/seed-sample-data.ts', { cwd: process.cwd() });
      console.log('✅ 种子数据创建完成');
      
      // 等待一段时间确保数据库操作完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error: any) {
      console.error('❌ 数据库重置失败:', error.message);
      throw error;
    }
  }

  private async createAuthenticatedClient(user: TestUser): Promise<AxiosInstance> {
    const jar = new CookieJar();
    const client = wrapper(axios.create({
      baseURL: this.baseUrl,
      jar,
      timeout: 10000,
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
        this.logResult(`Authentication - ${user.role}`, true, `User ${user.email} authenticated successfully`);
        return client;
      }
      
      throw new Error(`Login failed - Status: ${signinResponse.status}`);
      
    } catch (error: any) {
      this.logResult(`Authentication - ${user.role}`, false, undefined, `Failed to authenticate ${user.email}: ${error.message}`);
      throw error;
    }
  }

  private async testApiEndpoint(
    client: AxiosInstance | null,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    testName: string,
    data?: any,
    expectedStatus?: number
  ): Promise<{ success: boolean; data?: any; status?: number }> {
    const startTime = Date.now();
    
    try {
      const axiosClient = client || axios.create({ baseURL: this.baseUrl, timeout: 10000 });
      
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
        testName,
        success,
        success ? `${method} ${endpoint} - Response received` : undefined,
        !success ? `Expected status ${expectedStatus || 'success'}, got ${response.status}` : undefined,
        responseTime,
        response.status
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
        testName,
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

  async runAllTests(): Promise<TestReport> {
    console.log('🚀 开始全面API测试...');
    console.log(`📍 测试目标: ${this.baseUrl}`);
    console.log(`⏰ 开始时间: ${this.startTime.toLocaleString()}`);
    
    try {
      // 0. 数据重置
      console.log('\n=== 0. 数据重置 ===');
      await this.resetDatabase();
      
      // 1. 服务器连接测试
      console.log('\n=== 1. 服务器连接测试 ===');
      await this.testApiEndpoint(null, 'GET', '/', 'Server Connectivity');
      
      // 2. 公共API测试
      console.log('\n=== 2. 公共API测试 ===');
      await this.testApiEndpoint(null, 'GET', '/api/numbers', 'Public - Phone Numbers List');
      await this.testApiEndpoint(null, 'GET', '/api/auth/csrf', 'Auth - CSRF Token');
      await this.testApiEndpoint(null, 'GET', '/api/auth/session', 'Auth - Session Check');
      
      // 3. 用户认证测试
      console.log('\n=== 3. 用户认证测试 ===');
      for (const user of this.testUsers) {
        try {
          const client = await this.createAuthenticatedClient(user);
          this.authenticatedClients.set(user.role, client);
        } catch (error) {
          // 错误已在createAuthenticatedClient中记录
        }
      }
      
      // 4. 管理员API测试
      console.log('\n=== 4. 管理员API测试 ===');
      for (const [role, client] of this.authenticatedClients) {
        console.log(`\n--- 测试 ${role} 权限 ---`);
        
        // 基础管理API
        await this.testApiEndpoint(client, 'GET', '/api/admin/stats', `Admin Stats - ${role}`);
        await this.testApiEndpoint(client, 'GET', '/api/admin/numbers', `Admin Numbers List - ${role}`);
        await this.testApiEndpoint(client, 'GET', '/api/admin/organizations', `Admin Organizations - ${role}`);
        
        // 权限测试
        if (role === 'SUPER_ADMIN') {
          await this.testApiEndpoint(client, 'POST', '/api/admin/actions', `Admin Actions - ${role}`, {
            action: 'CLEAR_ALL_NUMBERS',  // 修改：从 'GET_STATS' 改为 'CLEAR_ALL_NUMBERS'
            payload: {}
          });
        }
      }
      
      // 5. 权限边界测试
      console.log('\n=== 5. 权限边界测试 ===');
      const marketerClient = this.authenticatedClients.get('MARKETER');
      if (marketerClient) {
        // 销售人员尝试访问超级管理员功能
        await this.testApiEndpoint(marketerClient, 'POST', '/api/admin/actions', 'Permission Boundary - MARKETER accessing SUPER_ADMIN', {
          action: 'CLEAR_ALL_NUMBERS',
          payload: {}
        }, 403);
      }
      
      // 6. 错误处理测试
      console.log('\n=== 6. 错误处理测试 ===');
      await this.testApiEndpoint(null, 'GET', '/api/nonexistent', 'Error Handling - 404 Not Found', undefined, 404);
      await this.testApiEndpoint(null, 'GET', '/api/admin/stats', 'Error Handling - Unauthorized Admin Access', undefined, 401);  // 修改：从 POST 改为 GET，移除请求体
      
    } catch (error: any) {
      console.error('❌ 测试执行失败:', error.message);
      this.logResult('Test Execution', false, undefined, error.message);
    }
    
    return this.generateReport();
  }

  private generateReport(): TestReport {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();
    const passed = this.testResults.filter(r => r.success).length;
    const failed = this.testResults.filter(r => !r.success).length;
    const failedTests = this.testResults.filter(r => !r.success);
    
    // 按用户角色分组测试结果
    const userTests: Record<string, TestResult[]> = {};
    this.testResults.forEach(result => {
      const roleMatch = result.testName.match(/- (SUPER_ADMIN|SCHOOL_ADMIN|MARKETER)/);
      if (roleMatch) {
        const role = roleMatch[1];
        if (!userTests[role]) userTests[role] = [];
        userTests[role].push(result);
      }
    });
    
    // 计算API覆盖率
    const testedEndpoints = new Set(
      this.testResults.map(r => {
        const match = r.testName.match(/(?:GET|POST|PUT|DELETE)\s+(\/[^\s]+)/);
        return match ? match[1] : null;
      }).filter(Boolean)
    ).size;
    
    const totalEndpoints = 12; // 根据实际API数量调整
    const coverage = (testedEndpoints / totalEndpoints) * 100;
    
    const report: TestReport = {
      summary: {
        total: this.testResults.length,
        passed,
        failed,
        duration,
        timestamp: endTime.toISOString()
      },
      testResults: this.testResults,
      failedTests,
      userTests,
      apiCoverage: {
        totalEndpoints,
        testedEndpoints,
        coverage: Math.round(coverage * 100) / 100
      }
    };
    
    this.printReport(report);
    this.saveJsonReport(report);
    
    return report;
  }

  private printReport(report: TestReport) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 测试报告总结');
    console.log('='.repeat(80));
    console.log(`📈 总测试数: ${report.summary.total}`);
    console.log(`✅ 通过: ${report.summary.passed}`);
    console.log(`❌ 失败: ${report.summary.failed}`);
    console.log(`📊 成功率: ${((report.summary.passed / report.summary.total) * 100).toFixed(2)}%`);
    console.log(`⏱️  总耗时: ${(report.summary.duration / 1000).toFixed(2)}秒`);
    console.log(`🎯 API覆盖率: ${report.apiCoverage.coverage}% (${report.apiCoverage.testedEndpoints}/${report.apiCoverage.totalEndpoints})`);
    
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
    
    console.log('\n🎯 测试用户信息:');
    this.testUsers.forEach(user => {
      console.log(`   • ${user.role}: ${user.email} - ${user.description}`);
    });
    
    console.log('\n' + '='.repeat(80));
  }

  private saveJsonReport(report: TestReport) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 只保存JSON报告
    const jsonReportPath = path.join(process.cwd(), `api-test-report-${timestamp}.json`);
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
    console.log(`📄 JSON报告已保存: ${jsonReportPath}`);
  }
}

// 主执行函数
async function main() {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
  const tester = new ComprehensiveAPITester(baseUrl);
  
  try {
    const report = await tester.runAllTests();
    
    // 根据测试结果设置退出码
    const exitCode = report.summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export { ComprehensiveAPITester };