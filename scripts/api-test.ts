import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

interface TestUser {
  email: string;
  password: string;
  role: string;
}

interface TestResult {
  testName: string;
  success: boolean;
  details?: string;
  errorMessage?: string;
  timestamp: Date;
}

class APITester {
  private baseUrl: string;
  private testResults: TestResult[] = [];
  private authenticatedClients: Map<string, AxiosInstance> = new Map();

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  private logResult(testName: string, success: boolean, details?: string, errorMessage?: string) {
    const result: TestResult = {
      testName,
      success,
      details,
      errorMessage,
      timestamp: new Date()
    };
    this.testResults.push(result);
    
    const status = success ? '✅' : '❌';
    const message = success ? (details || 'Success') : (errorMessage || 'Failed');
    console.log(`${status} ${testName}: ${message}`);
  }

  private async createAuthenticatedClient(user: TestUser): Promise<AxiosInstance> {
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar, baseURL: this.baseUrl }));

    try {
      // 1. 获取CSRF token
      const csrfResponse = await client.get('/api/auth/csrf');
      const csrfToken = csrfResponse.data.csrfToken;

      // 2. 执行登录
      const loginData = new URLSearchParams({
        email: user.email,
        password: user.password,
        csrfToken: csrfToken,
        callbackUrl: `${this.baseUrl}/admin/dashboard`,
        redirect: 'false',
        json: 'true'
      });

      const loginResponse = await client.post('/api/auth/callback/credentials', loginData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 400 || status === 302
      });

      // 3. 验证登录是否成功
      const sessionResponse = await client.get('/api/auth/session');
      if (sessionResponse.data && sessionResponse.data.user) {
        this.logResult(`Auth - Login ${user.role}`, true, `Logged in as ${sessionResponse.data.user.email}`);
        return client;
      } else {
        throw new Error('Session not established');
      }
    } catch (error) {
      this.logResult(`Auth - Login ${user.role}`, false, undefined, `Login failed: ${error.message}`);
      throw error;
    }
  }

  private async testApiEndpoint(
    client: AxiosInstance | null,
    method: string,
    endpoint: string,
    testName: string,
    data?: any,
    expectedStatus?: number
  ) {
    try {
      const config: any = {
        method: method.toLowerCase(),
        url: endpoint,
        validateStatus: () => true // 接受所有状态码
      };

      if (data) {
        config.data = data;
        config.headers = { 'Content-Type': 'application/json' };
      }

      const response = client ? await client(config) : await axios({
        ...config,
        baseURL: this.baseUrl
      });

      const success = expectedStatus ? response.status === expectedStatus : response.status < 400;
      
      if (success) {
        this.logResult(testName, true, `Status: ${response.status}`);
      } else {
        this.logResult(testName, false, undefined, `HTTP ${response.status} - ${JSON.stringify(response.data)}`);
      }

      return { success, status: response.status, data: response.data };
    } catch (error) {
      this.logResult(testName, false, undefined, `Request failed: ${error.message}`);
      return { success: false, status: 0, data: null };
    }
  }

  async runAllTests() {
    console.log('🚀 开始API测试...');
    console.log(`测试目标: ${this.baseUrl}`);
    console.log(`开始时间: ${new Date().toLocaleString()}`);
    console.log('\n=== 1. 服务器连接测试 ===');

    // 1. 服务器连接测试
    await this.testApiEndpoint(null, 'GET', '/', 'Server Connectivity');

    console.log('\n=== 2. 公共API测试 ===');
    
    // 2. 公共API测试
    const numbersResult = await this.testApiEndpoint(null, 'GET', '/api/numbers', 'Public - Phone Numbers List');
    await this.testApiEndpoint(null, 'GET', '/api/numbers?hideReserved=true&page=1', 'Public - Filtered Numbers');

    console.log('\n=== 3. 用户注册测试 ===');
    
    // 3. 用户注册测试
    const testEmail = `test-${Date.now()}@example.com`;
    const registerData = {
      name: 'Test User',
      email: testEmail,
      password: '123456',
      organizationId: 'school-1'
    };
    
    await this.testApiEndpoint(null, 'POST', '/api/register', 'Registration - New User', registerData);
    await this.testApiEndpoint(null, 'POST', '/api/register', 'Registration - Duplicate Email (Should Fail)', registerData, 409);

    console.log('\n=== 4. 认证测试 ===');
    
    // 4. 认证测试
    const testUsers: TestUser[] = [
      { email: 'admin@system.com', password: '123456', role: 'SUPER_ADMIN' },
      { email: 'admin@pku.edu.cn', password: '123456', role: 'SCHOOL_ADMIN' },
      { email: 'marketer1@telecom.com', password: '123456', role: 'MARKETER' }
    ];

    for (const user of testUsers) {
      try {
        const client = await this.createAuthenticatedClient(user);
        this.authenticatedClients.set(user.role, client);
      } catch (error) {
        // 错误已在createAuthenticatedClient中记录
      }
    }

    console.log('\n=== 5. 管理员API测试 ===');
    
    // 5. 管理员API测试
    for (const [role, client] of this.authenticatedClients) {
      console.log(`\n--- 测试 ${role} 权限 ---`);
      
      await this.testApiEndpoint(client, 'GET', '/api/admin/stats', `Admin - Statistics (${role})`);
      await this.testApiEndpoint(client, 'GET', '/api/admin/numbers', `Admin - Numbers Management (${role})`);
      await this.testApiEndpoint(client, 'GET', '/api/admin/organizations', `Admin - Organizations (${role})`);
      await this.testApiEndpoint(client, 'GET', '/api/admin/pending-orders', `Admin - Pending Orders (${role})`);
      await this.testApiEndpoint(client, 'GET', '/api/admin/organizations?type=SCHOOL', `Admin - School Organizations (${role})`);
      await this.testApiEndpoint(client, 'GET', '/api/admin/organizations?type=DEPARTMENT', `Admin - Department Organizations (${role})`);
    }

    console.log('\n=== 6. 订单创建测试 ===');
    
    // 6. 订单创建测试
    if (numbersResult.success && numbersResult.data && numbersResult.data.length > 0) {
      const availableNumber = numbersResult.data.find((num: any) => num.reservationStatus === 'UNRESERVED');
      
      if (availableNumber) {
        const orderData = {
          numberId: availableNumber.id,
          customerName: 'Test Customer',
          customerContact: '13800138000',
          paymentAmount: 20
        };
        
        await this.testApiEndpoint(null, 'POST', '/api/orders', 'Orders - Create New Order', orderData);
      }
    }

    console.log('\n=== 7. 安全测试 ===');
    
    // 7. 安全测试
    await this.testApiEndpoint(null, 'GET', '/api/admin/stats', 'Security - Unauthorized Access', undefined, 401);
    
    // 测试无效token
    const invalidClient = axios.create({
      baseURL: this.baseUrl,
      headers: { 'Authorization': 'Bearer invalid_token' }
    });
    await this.testApiEndpoint(invalidClient, 'GET', '/api/admin/stats', 'Security - Invalid Token', undefined, 401);

    console.log('\n=== 8. 错误处理测试 ===');
    
    // 8. 错误处理测试
    await this.testApiEndpoint(null, 'GET', '/api/nonexistent', 'Error Handling - Non-existent Endpoint', undefined, 404);
    
    const malformedData = { invalid: 'data' };
    await this.testApiEndpoint(null, 'POST', '/api/orders', 'Error Handling - Malformed Request', malformedData, 400);

    // 生成测试报告
    this.generateReport();
  }

  private generateReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    console.log('\n=== 📊 测试报告 ===');
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${passedTests}`);
    console.log(`失败: ${failedTests}`);
    console.log(`成功率: ${successRate}%`);
    console.log(`结束时间: ${new Date().toLocaleString()}`);

    if (failedTests > 0) {
      console.log('\n=== ❌ 失败的测试 ===');
      this.testResults
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`❌ ${r.testName}: ${r.errorMessage}`);
        });
    }

    // 保存测试报告到文件
    const reportData = {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate,
        timestamp: new Date().toISOString()
      },
      results: this.testResults
    };

    const fs = require('fs');
    const reportFileName = `api-test-report-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.json`;
    fs.writeFileSync(reportFileName, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 测试报告已保存到: ${reportFileName}`);
  }
}

// 运行测试
if (require.main === module) {
  const tester = new APITester();
  tester.runAllTests().catch(console.error);
}

export default APITester;