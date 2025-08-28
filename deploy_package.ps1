# PowerShell script to create deployment package
Write-Host "Creating deployment package..." -ForegroundColor Green
Write-Host ""

# Set variables
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$packageName = "telecom-deploy-$timestamp"
$tempDir = "temp_deploy"
$requiredFiles = @()
$warnings = @()

# Function to check and copy files
function Copy-WithValidation {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Description,
        [bool]$Required = $true
    )
    
    if (Test-Path $Source) {
        try {
            Copy-Item -Path $Source -Destination $Destination -Recurse -Force
            Write-Host "✓ $Description copied" -ForegroundColor Green
            return $true
        } catch {
            Write-Host "❌ Failed to copy $Description`: $($_.Exception.Message)" -ForegroundColor Red
            if ($Required) { throw "Critical file copy failed: $Description" }
            return $false
        }
    } else {
        if ($Required) {
            throw "Required file/directory not found: $Source"
        } else {
            Write-Host "⚠ $Description not found, skipping" -ForegroundColor Yellow
            $script:warnings += "Missing optional: $Description"
            return $false
        }
    }
}

# Create temporary directory
if (Test-Path $tempDir) {
    Write-Host "Cleaning old temporary directory..." -ForegroundColor Yellow
    Remove-Item -Path $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    # Validate build exists
    Write-Host "Validating build files..." -ForegroundColor Cyan
    if (!(Test-Path "./.next")) {
        throw "Build not found. Please run 'npm run build' first."
    }
    
    # Copy standalone files (excluding node_modules)
    Write-Host "Copying standalone application..." -ForegroundColor Cyan
    if (Test-Path "./.next/standalone") {
        # Copy all files and folders except node_modules
        Get-ChildItem -Path "./.next/standalone" | Where-Object { $_.Name -ne "node_modules" } | ForEach-Object {
            Copy-Item -Path $_.FullName -Destination $tempDir -Recurse -Force
        }
        
        # Verify critical files exist in standalone
        $criticalFiles = @("server.js", "package.json")
        foreach ($file in $criticalFiles) {
            if (!(Test-Path "$tempDir/$file")) {
                throw "Critical standalone file missing: $file"
            }
        }
        Write-Host "✓ Standalone application copied and validated" -ForegroundColor Green
    } else {
        throw "Standalone directory not found. Ensure next.config.ts has output: 'standalone'"
    }

    # Copy static files
    Write-Host "Copying static assets..." -ForegroundColor Cyan
    $staticDestDir = "$tempDir/.next"
    if (!(Test-Path $staticDestDir)) {
        New-Item -ItemType Directory -Path $staticDestDir -Force | Out-Null
    }
    Copy-WithValidation "./.next/static" "$tempDir/.next/static" "Static assets" $true

    # Copy public files
    Write-Host "Copying public files..." -ForegroundColor Cyan
    Copy-WithValidation "./public" "$tempDir/public" "Public files" $false

    # Copy prisma directory (includes database file and migrations)
    Write-Host "Copying database and migrations..." -ForegroundColor Cyan
    if (Copy-WithValidation "./prisma" "$tempDir/prisma" "Prisma files" $true) {
        # Validate prisma files
        $prismaFiles = @("schema.prisma")
        foreach ($file in $prismaFiles) {
            if (!(Test-Path "$tempDir/prisma/$file")) {
                throw "Critical Prisma file missing: $file"
            }
        }
        
        # Check for migrations
        if (Test-Path "$tempDir/prisma/migrations") {
            $migrationCount = (Get-ChildItem "$tempDir/prisma/migrations" -Directory).Count
            Write-Host "  → Found $migrationCount migration(s)" -ForegroundColor Gray
        }
        
        # Check for database file
        if (Test-Path "$tempDir/prisma/dev.db") {
            $dbSize = [math]::Round((Get-Item "$tempDir/prisma/dev.db").Length / 1KB, 2)
            Write-Host "  → Database file included ($dbSize KB)" -ForegroundColor Gray
        } else {
            Write-Host "  → Database will be created during first run" -ForegroundColor Gray
        }
    }

    # Copy environment files
    Write-Host "Copying environment configuration..." -ForegroundColor Cyan
    $envCopied = $false
    
    # Try different env file names
    $envFiles = @(".env.production", ".env.local", ".env")
    foreach ($envFile in $envFiles) {
        if (Test-Path $envFile) {
            Copy-Item -Path $envFile -Destination "$tempDir/.env" -Force
            Write-Host "✓ Environment file copied from $envFile" -ForegroundColor Green
            $envCopied = $true
            break
        }
    }
    
    if (!$envCopied) {
        $script:warnings += "No environment file found. Create .env in deployment location."
        Write-Host "⚠ No environment file found" -ForegroundColor Yellow
    }

    # Copy additional necessary files
    Write-Host "Copying additional files..." -ForegroundColor Cyan
    
    # Copy package.json for production dependencies info
    Copy-WithValidation "./package.json" "$tempDir/package-info.json" "Package info" $false
    
    # Copy next.config.ts/js for reference
    $nextConfigCopied = $false
    $nextConfigs = @("next.config.ts", "next.config.js", "next.config.mjs")
    foreach ($config in $nextConfigs) {
        if (Test-Path $config) {
            Copy-WithValidation $config "$tempDir/$config" "Next.js config" $false
            $nextConfigCopied = $true
            break
        }
    }
    
    # Create deployment info file
    Write-Host "Creating deployment info..." -ForegroundColor Cyan
    $deployInfo = @"
Deployment Package Information
==============================
Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Node.js Version Required: $(node --version 2>$null)
Next.js Version: $(npm list next --depth=0 2>$null | Select-String 'next@')

Deployment Instructions:
1. Extract this package to your server
2. Ensure Node.js is installed
3. Set up environment variables in .env file
4. Run: node server.js
5. Application will be available on the configured port

Included Files:
- Standalone Next.js application
- Static assets and public files
- Database schema and migrations
- Environment configuration template

Warnings:
$(if ($script:warnings.Count -gt 0) { $script:warnings -join "`n" } else { "None" })
"@
    
    $deployInfo | Out-File -FilePath "$tempDir/DEPLOYMENT_INFO.txt" -Encoding UTF8
    Write-Host "✓ Deployment info created" -ForegroundColor Green

    # Validate final package
    Write-Host "Validating package contents..." -ForegroundColor Cyan
    $requiredInPackage = @("server.js", ".next/static", "prisma")
    foreach ($item in $requiredInPackage) {
        if (!(Test-Path "$tempDir/$item")) {
            throw "Package validation failed: Missing $item"
        }
    }
    Write-Host "✓ Package validation passed" -ForegroundColor Green

    # Package with 7za.exe
    Write-Host ""
    Write-Host "Creating compressed package..." -ForegroundColor Cyan
    
    # Check if 7za.exe is available
    try {
        $null = Get-Command "7za.exe" -ErrorAction Stop
    } catch {
        throw "7za.exe not found. Please install 7-Zip or add it to PATH."
    }
    
    $zipCommand = "7za.exe a -t7z `"$packageName.7z`" `"./$tempDir/*`" -mx=9"
    $result = Invoke-Expression $zipCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Package compressed successfully" -ForegroundColor Green
    } else {
        throw "Package compression failed with exit code $LASTEXITCODE"
    }

    # Clean up temporary directory
    Write-Host "Cleaning temporary files..." -ForegroundColor Yellow
    Remove-Item -Path $tempDir -Recurse -Force

    # Show results
    Write-Host ""
    Write-Host "🎉 Deployment package created successfully!" -ForegroundColor Green
    Write-Host "Package: $packageName.7z" -ForegroundColor White
    
    if (Test-Path "$packageName.7z") {
        $fileSize = (Get-Item "$packageName.7z").Length
        $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
        Write-Host "Size: $fileSizeMB MB" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "📦 Package Contents:" -ForegroundColor Cyan
    Write-Host "  ✓ Standalone Next.js application" -ForegroundColor Gray
    Write-Host "  ✓ Static assets and public files" -ForegroundColor Gray
    Write-Host "  ✓ Database schema and migrations" -ForegroundColor Gray
    Write-Host "  ✓ Environment configuration" -ForegroundColor Gray
    Write-Host "  ✓ Deployment instructions" -ForegroundColor Gray
    
    if ($script:warnings.Count -gt 0) {
        Write-Host ""
        Write-Host "⚠ Warnings:" -ForegroundColor Yellow
        foreach ($warning in $script:warnings) {
            Write-Host "  • $warning" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "🚀 Ready for deployment!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ Failed to create deployment package!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Clean up on error
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force
    }
    
    Write-Host ""
    Write-Host "💡 Troubleshooting:" -ForegroundColor Cyan
    Write-Host "  1. Ensure 'npm run build' completed successfully" -ForegroundColor Gray
    Write-Host "  2. Check that next.config.ts has output: 'standalone'" -ForegroundColor Gray
    Write-Host "  3. Verify 7-Zip is installed and in PATH" -ForegroundColor Gray
    Write-Host "  4. Ensure all required files exist" -ForegroundColor Gray
    
    exit 1
}

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")