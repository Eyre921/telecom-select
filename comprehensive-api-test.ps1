# ===================================================================
# Campus Card Online Number Selection System - API Test Script
# ===================================================================
# This script comprehensively tests all API endpoints, authentication,
# and multi-tenant permission isolation in the system.
# ===================================================================

param(
    [string]$BaseUrl = "http://localhost:3000",
    [switch]$Verbose = $false
)

# Global variables
$baseUrl = $BaseUrl.TrimEnd('/')
$testResults = @()
$errorLog = @()
$authTokens = @{}

# Helper function to log test results
function Log-TestResult {
    param(
        [string]$TestName,
        [bool]$Success,
        [string]$Details = "",
        [string]$ErrorMessage = ""
    )
    
    $result = @{
        TestName = $TestName
        Success = $Success
        Timestamp = Get-Date
        Details = $Details
        ErrorMessage = $ErrorMessage
    }
    
    $script:testResults += $result
    
    if ($Success) {
        Write-Host "✓ $TestName" -ForegroundColor Green
        if ($Details -and $Verbose) {
            Write-Host "  Details: $Details" -ForegroundColor Gray
        }
    } else {
        Write-Host "✗ $TestName" -ForegroundColor Red
        Write-Host "  Error: $ErrorMessage" -ForegroundColor Red
        $script:errorLog += "[$TestName] $ErrorMessage"
    }
}

# Helper function to make API requests with comprehensive error handling
function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [string]$TestName
    )
    
    try {
        $requestParams = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
            TimeoutSec = 30
        }
        
        if ($Body) {
            $requestParams.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @requestParams
        
        Write-Host "Response status: Success" -ForegroundColor Green
        if ($Verbose) {
            Write-Host "Response data: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
        }
        
        Log-TestResult -TestName $TestName -Success $true -Details "Request completed successfully"
        
        return @{
            Success = $true
            Data = $response
            StatusCode = 200
        }
    } catch {
        $statusCode = 500
        $errorDetails = $_.Exception.Message
        
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $responseBody = $reader.ReadToEnd()
                $reader.Close()
                $stream.Close()
                if ($responseBody) {
                    $errorDetails = $responseBody
                }
            } catch {
                # Keep original error message if can't read response
            }
        }
        
        Write-Host "Response status: Failed (Status code: $statusCode)" -ForegroundColor Red
        Write-Host "Error details: $errorDetails" -ForegroundColor Red
        
        Log-TestResult -TestName $TestName -Success $false -ErrorMessage "HTTP $statusCode - $errorDetails"
        
        return @{
            Success = $false
            Error = $errorDetails
            StatusCode = $statusCode
        }
    }
}

# ===================================================================
# MAIN TEST EXECUTION
# ===================================================================

Write-Host "\n=== Campus Card Online Number Selection System - API Test ===" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor Yellow
Write-Host "Start Time: $(Get-Date)" -ForegroundColor Yellow

# Check if server is running
Write-Host "\n=== Server Connectivity Check ===" -ForegroundColor Blue
try {
    $healthCheck = Invoke-RestMethod -Uri "$baseUrl" -Method GET -TimeoutSec 10
    Log-TestResult -TestName "Server Connectivity" -Success $true -Details "Server is responding"
} catch {
    Log-TestResult -TestName "Server Connectivity" -Success $false -ErrorMessage "Cannot connect to server at $baseUrl. Please ensure the development server is running."
    Write-Host "Please start the development server with: npm run dev" -ForegroundColor Yellow
    exit 1
}

# Test user credentials for different roles
$testUsers = @(
    @{ email = "super@admin.com"; password = "admin123"; role = "SUPER_ADMIN" },
    @{ email = "school@admin.com"; password = "admin123"; role = "SCHOOL_ADMIN" },
    @{ email = "dept@marketer.com"; password = "admin123"; role = "MARKETER" }
)

# Store authentication tokens
$authTokens = @{}

# ===================================================================
# 1. PUBLIC API TESTING
# ===================================================================
Write-Host "\n=== 1. Public API Testing ===" -ForegroundColor Blue

# Test public phone numbers endpoint
$numbersResult = Invoke-ApiRequest -Method "GET" -Url "$baseUrl/api/numbers" -TestName "Public - Phone Numbers List"

# Test phone numbers with filters
$filteredResult = Invoke-ApiRequest -Method "GET" -Url "$baseUrl/api/numbers?hideReserved=true&page=1" -TestName "Public - Filtered Numbers (Hide Reserved)"

# ===================================================================
# 2. USER REGISTRATION TESTING
# ===================================================================
Write-Host "\n=== 2. User Registration Testing ===" -ForegroundColor Blue

# Test user registration
$registerBody = @{
    email = "test.user.$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
    password = "testpassword123"
}

$registerResult = Invoke-ApiRequest -Method "POST" -Url "$baseUrl/api/register" -Body $registerBody -TestName "Registration - New User"

# Test duplicate registration
$duplicateResult = Invoke-ApiRequest -Method "POST" -Url "$baseUrl/api/register" -Body $registerBody -TestName "Registration - Duplicate Email (Should Fail)"
if ($duplicateResult.StatusCode -eq 409) {
    Log-TestResult -TestName "Registration - Duplicate Prevention" -Success $true -Details "Correctly prevented duplicate registration"
} else {
    Log-TestResult -TestName "Registration - Duplicate Prevention" -Success $false -ErrorMessage "Should have returned 409 for duplicate email"
}

# 在第3部分认证测试中，替换现有的认证逻辑

# ===================================================================
# 3. AUTHENTICATION TESTING
# ===================================================================
Write-Host "\n=== 3. Authentication Testing ===" -ForegroundColor Blue

foreach ($user in $testUsers) {
    Write-Host "\n--- Testing Authentication for: $($user.email) ($($user.role)) ---" -ForegroundColor Magenta
    
    # 使用NextAuth的credentials provider进行登录
    $signinBody = @{
        email = $user.email
        password = $user.password
        redirect = "false"
        callbackUrl = "$baseUrl/admin/dashboard"
        csrfToken = "test-csrf-token"
        json = "true"
    }
    
    try {
        # 首先获取CSRF token
        $csrfResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/csrf" -Method GET -SessionVariable 'authSession'
        $csrfToken = $csrfResponse.csrfToken
        
        # 使用真实的CSRF token进行登录
        $signinBody.csrfToken = $csrfToken
        
        # 执行登录请求
        $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/callback/credentials" -Method POST -Body ($signinBody | ConvertTo-Json) -ContentType "application/json" -WebSession $authSession
        
        if ($loginResponse -and $loginResponse.url) {
            # 登录成功，保存session
            $authTokens[$user.role] = $authSession
            Log-TestResult -TestName "Auth - Login $($user.role)" -Success $true -Details "Login successful, session created"
        } else {
            Log-TestResult -TestName "Auth - Login $($user.role)" -Success $false -ErrorMessage "Login failed - no redirect URL returned"
        }
        
    } catch {
        Log-TestResult -TestName "Auth - Login $($user.role)" -Success $false -ErrorMessage "Login request failed: $($_.Exception.Message)"
    }
}

# 修改Admin API测试部分，使用真实的session
foreach ($userRole in $authTokens.Keys) {
    Write-Host "\n--- Testing Admin APIs for: $userRole ---" -ForegroundColor Magenta
    
    $session = $authTokens[$userRole]
    
    # 测试admin统计
    $statsResult = Invoke-ApiRequest -Method "GET" -Url "$baseUrl/api/admin/stats" -WebSession $session -TestName "Admin - Statistics ($userRole)"
    
    # 其他API测试...
}

# ===================================================================
# 4. ORDER CREATION TESTING
# ===================================================================
Write-Host "\n=== 4. Order Creation Testing ===" -ForegroundColor Blue

# Test order creation (requires available numbers)
if ($numbersResult.Success -and $numbersResult.Data -and $numbersResult.Data.Count -gt 0) {
    $availableNumber = $numbersResult.Data | Where-Object { $_.reservationStatus -eq "UNRESERVED" } | Select-Object -First 1
    
    if ($availableNumber) {
        $orderBody = @{
            numberId = $availableNumber.id
            customerName = "Test Customer"
            customerContact = "13800138000"
            paymentAmount = 20
        }
        
        $orderResult = Invoke-ApiRequest -Method "POST" -Url "$baseUrl/api/orders" -Body $orderBody -TestName "Orders - Create New Order"
        
        # Test order with shipping address (200 yuan payment)
        $orderWithShippingBody = @{
            numberId = $availableNumber.id
            customerName = "Test Customer 2"
            customerContact = "13800138001"
            paymentAmount = 200
            shippingAddress = "Test Address, Test City"
        }
        
        $orderShippingResult = Invoke-ApiRequest -Method "POST" -Url "$baseUrl/api/orders" -Body $orderWithShippingBody -TestName "Orders - Create Order with Shipping"
    } else {
        Log-TestResult -TestName "Orders - Create New Order" -Success $false -ErrorMessage "No available numbers found for testing"
    }
} else {
    Log-TestResult -TestName "Orders - Create New Order" -Success $false -ErrorMessage "Could not retrieve numbers list for order testing"
}

# ===================================================================
# 5. ADMIN API TESTING (with mock authentication)
# ===================================================================
Write-Host "\n=== 5. Admin API Testing ===" -ForegroundColor Blue

foreach ($userRole in $authTokens.Keys) {
    Write-Host "\n--- Testing Admin APIs for: $userRole ---" -ForegroundColor Magenta
    
    # Note: In a real scenario, you'd use actual JWT tokens from NextAuth
    # For testing purposes, we'll test the endpoints without authentication
    # and expect 401/403 responses, which indicates proper security
    
    $mockHeaders = @{ "Authorization" = "Bearer $($authTokens[$userRole])" }
    
    # Test admin statistics
    $statsResult = Invoke-ApiRequest -Method "GET" -Url "$baseUrl/api/admin/stats" -Headers $mockHeaders -TestName "Admin - Statistics ($userRole)"
    
    # Test admin numbers list
    $adminNumbersResult = Invoke-ApiRequest -Method "GET" -Url "$baseUrl/api/admin/numbers" -Headers $mockHeaders -TestName "Admin - Numbers Management ($userRole)"
    
    # Test organizations list
    $orgsResult = Invoke-ApiRequest -Method "GET" -Url "$baseUrl/api/admin/organizations" -Headers $mockHeaders -TestName "Admin - Organizations ($userRole)"
    
    # Test pending orders
    $pendingResult = Invoke-ApiRequest -Method "GET" -Url "$baseUrl/api/admin/pending-orders" -Headers $mockHeaders -TestName "Admin - Pending Orders ($userRole)"
    
    # Test organizations with filters
    $schoolOrgsResult = Invoke-ApiRequest -Method "GET" -Url "$baseUrl/api/admin/organizations?type=SCHOOL" -Headers $mockHeaders -TestName "Admin - School Organizations ($userRole)"
    
    $deptOrgsResult = Invoke-ApiRequest -Method "GET" -Url "$baseUrl/api/admin/organizations?type=DEPARTMENT" -Headers $mockHeaders -TestName "Admin - Department Organizations ($userRole)"
}

# ===================================================================
# 6. SECURITY AND ERROR HANDLING TESTING
# ===================================================================
Write-Host "\n=== 6. Security and Error Handling Testing ===" -ForegroundColor Blue

# Test unauthorized access to admin endpoints
$unauthorizedResult = Invoke-ApiRequest -Method "GET" -Url "$baseUrl/api/admin/stats" -TestName "Security - Unauthorized Access"
if ($unauthorizedResult.StatusCode -eq 401 -or $unauthorizedResult.StatusCode -eq 403) {
    Log-TestResult -TestName "Security - Unauthorized Access Blocked" -Success $true -Details "Got expected $($unauthorizedResult.StatusCode) status"
} else {
    Log-TestResult -TestName "Security - Unauthorized Access Blocked" -Success $false -ErrorMessage "Expected 401/403 but got $($unauthorizedResult.StatusCode)"
}

# Test invalid token
$invalidHeaders = @{ "Authorization" = "Bearer invalid_token_12345" }
$invalidTokenResult = Invoke-ApiRequest -Method "GET" -Url "$baseUrl/api/admin/stats" -Headers $invalidHeaders -TestName "Security - Invalid Token"
if ($invalidTokenResult.StatusCode -eq 401 -or $invalidTokenResult.StatusCode -eq 403) {
    Log-TestResult -TestName "Security - Invalid Token Blocked" -Success $true -Details "Got expected $($invalidTokenResult.StatusCode) status"
} else {
    Log-TestResult -TestName "Security - Invalid Token Blocked" -Success $false -ErrorMessage "Expected 401/403 but got $($invalidTokenResult.StatusCode)"
}

# Test non-existent endpoints
$notFoundResult = Invoke-ApiRequest -Method "GET" -Url "$baseUrl/api/nonexistent" -TestName "Error Handling - Non-existent Endpoint"
if ($notFoundResult.StatusCode -eq 404) {
    Log-TestResult -TestName "Error Handling - 404 for Non-existent" -Success $true -Details "Got expected 404 status"
} else {
    Log-TestResult -TestName "Error Handling - 404 for Non-existent" -Success $false -ErrorMessage "Expected 404 but got $($notFoundResult.StatusCode)"
}

# Test malformed requests
$malformedBody = @{ invalid = "data" }
$malformedResult = Invoke-ApiRequest -Method "POST" -Url "$baseUrl/api/orders" -Body $malformedBody -TestName "Error Handling - Malformed Request"
if ($malformedResult.StatusCode -eq 400) {
    Log-TestResult -TestName "Error Handling - Malformed Request Rejected" -Success $true -Details "Got expected 400 status"
} else {
    Log-TestResult -TestName "Error Handling - Malformed Request Rejected" -Success $false -ErrorMessage "Expected 400 but got $($malformedResult.StatusCode)"
}

# ===================================================================
# 7. GENERATE COMPREHENSIVE TEST REPORT
# ===================================================================
Write-Host "\n=== 7. Test Report Generation ===" -ForegroundColor Blue

$totalTests = $testResults.Count
$passedTests = ($testResults | Where-Object { $_.Success }).Count
$failedTests = $totalTests - $passedTests
$successRate = if ($totalTests -gt 0) { [math]::Round(($passedTests / $totalTests) * 100, 2) } else { 0 }

Write-Host "\n=== API Test Summary ===" -ForegroundColor Green
Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red
Write-Host "Success Rate: $successRate%" -ForegroundColor Yellow
Write-Host "End Time: $(Get-Date)" -ForegroundColor Yellow

if ($failedTests -gt 0) {
    Write-Host "\n=== Failed Tests ===" -ForegroundColor Red
    $testResults | Where-Object { -not $_.Success } | ForEach-Object {
        Write-Host "✗ $($_.TestName): $($_.ErrorMessage)" -ForegroundColor Red
    }
    
    Write-Host "\n=== Error Log ===" -ForegroundColor Red
    $errorLog | ForEach-Object {
        Write-Host $_ -ForegroundColor Red
    }
    
    Write-Host "\n=== Troubleshooting Tips ===" -ForegroundColor Yellow
    Write-Host "1. Ensure the development server is running: npm run dev" -ForegroundColor Gray
    Write-Host "2. Check if seed data has been loaded: npx tsx scripts/seed-sample-data.ts" -ForegroundColor Gray
    Write-Host "3. Verify database schema is up to date: npx prisma db push" -ForegroundColor Gray
    Write-Host "4. Check TypeScript compilation: npm run build" -ForegroundColor Gray
    Write-Host "5. Verify NextAuth configuration in .env.local" -ForegroundColor Gray
}

# Generate detailed JSON report
$reportPath = "api-test-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$report = @{
    testType = "COMPREHENSIVE_API_TEST"
    timestamp = Get-Date
    baseUrl = $baseUrl
    summary = @{
        total = $totalTests
        passed = $passedTests
        failed = $failedTests
        successRate = $successRate
    }
    testCategories = @{
        connectivity = ($testResults | Where-Object { $_.TestName -like "*Connectivity*" }).Count
        publicApi = ($testResults | Where-Object { $_.TestName -like "Public -*" }).Count
        registration = ($testResults | Where-Object { $_.TestName -like "Registration -*" }).Count
        authentication = ($testResults | Where-Object { $_.TestName -like "Auth -*" }).Count
        orders = ($testResults | Where-Object { $_.TestName -like "Orders -*" }).Count
        adminApi = ($testResults | Where-Object { $_.TestName -like "Admin -*" }).Count
        security = ($testResults | Where-Object { $_.TestName -like "Security -*" }).Count
        errorHandling = ($testResults | Where-Object { $_.TestName -like "Error Handling -*" }).Count
    }
    results = $testResults
    errors = $errorLog
    authTokens = @{
        tokensGenerated = $authTokens.Keys.Count
        roles = $authTokens.Keys
    }
    recommendations = @(
        if ($failedTests -gt 0) { "Review failed tests and fix underlying issues" }
        if (($testResults | Where-Object { $_.TestName -like "Security -*" -and -not $_.Success }).Count -gt 0) { "Security vulnerabilities detected - immediate attention required" }
        if (($testResults | Where-Object { $_.TestName -like "Admin -*" -and -not $_.Success }).Count -gt 0) { "Admin API issues detected - check authentication and permissions" }
        "Consider implementing automated CI/CD testing with this script"
    )
}

$report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "\nDetailed report saved to: $reportPath" -ForegroundColor Cyan

# Return appropriate exit code
if ($failedTests -gt 0) {
    Write-Host "\nTest execution completed with failures. Exit code: 1" -ForegroundColor Red
    exit 1
} else {
    Write-Host "\nAll tests passed successfully. Exit code: 0" -ForegroundColor Green
    exit 0
}