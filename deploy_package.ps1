# PowerShell script to create deployment package
Write-Host "Creating deployment package..." -ForegroundColor Green
Write-Host ""

# Set variables
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$packageName = "telecom-deploy-$timestamp"
$tempDir = "temp_deploy"

# Create temporary directory
if (Test-Path $tempDir) {
    Write-Host "Cleaning old temporary directory..." -ForegroundColor Yellow
    Remove-Item -Path $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    # Copy standalone files (excluding node_modules)
    Write-Host "Copying standalone files..." -ForegroundColor Cyan
    if (Test-Path "./.next/standalone") {
        # Copy all files and folders except node_modules
        Get-ChildItem -Path "./.next/standalone" | Where-Object { $_.Name -ne "node_modules" } | ForEach-Object {
            Copy-Item -Path $_.FullName -Destination $tempDir -Recurse -Force
        }
        Write-Host "✓ Standalone files copied (excluding node_modules)" -ForegroundColor Green
    } else {
        throw "Standalone directory not found at ./.next/standalone"
    }

    # Copy static files
    Write-Host "Copying static files..." -ForegroundColor Cyan
    $staticDestDir = "$tempDir/.next"
    if (!(Test-Path $staticDestDir)) {
        New-Item -ItemType Directory -Path $staticDestDir -Force | Out-Null
    }
    if (Test-Path "./.next/static") {
        Copy-Item -Path "./.next/static" -Destination "$tempDir/.next/static" -Recurse -Force
        Write-Host "✓ Static files copied" -ForegroundColor Green
    } else {
        Write-Host "⚠ Static directory not found, skipping" -ForegroundColor Yellow
    }

    # Copy public files
    Write-Host "Copying public files..." -ForegroundColor Cyan
    if (Test-Path "./public") {
        Copy-Item -Path "./public" -Destination "$tempDir/public" -Recurse -Force
        Write-Host "✓ Public files copied" -ForegroundColor Green
    } else {
        Write-Host "⚠ Public directory not found, skipping" -ForegroundColor Yellow
    }

    # Copy prisma directory (includes database file)
    Write-Host "Copying prisma files and database..." -ForegroundColor Cyan
    if (Test-Path "./prisma") {
        Copy-Item -Path "./prisma" -Destination "$tempDir/prisma" -Recurse -Force
        if (Test-Path "./prisma/dev.db") {
            Write-Host "✓ Prisma files and database copied" -ForegroundColor Green
        } else {
            Write-Host "✓ Prisma files copied (database will be created during migration)" -ForegroundColor Green
        }
    } else {
        Write-Host "⚠ Prisma directory not found, skipping" -ForegroundColor Yellow
    }

    # Copy .env file
    Write-Host "Copying environment file..." -ForegroundColor Cyan
    if (Test-Path "./.env") {
        Copy-Item -Path "./.env" -Destination "$tempDir/.env" -Force
        Write-Host "✓ Environment file copied" -ForegroundColor Green
    } else {
        Write-Host "⚠ .env file not found, skipping" -ForegroundColor Yellow
    }

    # Package with 7za.exe
    Write-Host ""
    Write-Host "Packaging deployment files..." -ForegroundColor Cyan
    $zipCommand = "7za.exe a -t7z `"$packageName.7z`" `"./$tempDir/*`" -mx=9"
    $result = Invoke-Expression $zipCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Package created successfully" -ForegroundColor Green
    } else {
        throw "7za.exe packaging failed"
    }

    # Clean up temporary directory
    Write-Host "Cleaning temporary files..." -ForegroundColor Yellow
    Remove-Item -Path $tempDir -Recurse -Force

    # Show results
    Write-Host ""
    Write-Host "Deployment package created successfully: $packageName.7z" -ForegroundColor Green
    if (Test-Path "$packageName.7z") {
        $fileSize = (Get-Item "$packageName.7z").Length
        $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
        Write-Host "File size: $fileSizeMB MB" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Deployment package is ready!" -ForegroundColor Green
    Write-Host "Package contains:" -ForegroundColor White
    Write-Host "  - Standalone application files (no node_modules)" -ForegroundColor Gray
    Write-Host "  - Static assets" -ForegroundColor Gray
    Write-Host "  - Public files" -ForegroundColor Gray
    Write-Host "  - Prisma schema, migrations and database" -ForegroundColor Gray
    Write-Host "  - Environment configuration" -ForegroundColor Gray
    
} catch {
    Write-Host ""
    Write-Host "❌ Failed to create deployment package!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Clean up on error
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force
    }
    
    exit 1
}

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")