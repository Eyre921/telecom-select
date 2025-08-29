# PowerShell script to create upgrade package
Write-Host "Creating upgrade package..." -ForegroundColor Green
Write-Host ""

# Set variables
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$packageName = "telecom-upgrade-$timestamp"
$tempDir = "temp_upgrade"

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

    # Package with PowerShell Compress-Archive (ZIP format)
    Write-Host ""
    Write-Host "Packaging upgrade files..." -ForegroundColor Cyan
    $zipPath = "$packageName.zip"
    Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -CompressionLevel Optimal -Force
    
    if (Test-Path $zipPath) {
        Write-Host "✓ Package created successfully" -ForegroundColor Green
    } else {
        throw "ZIP packaging failed"
    }

    # Clean up temporary directory
    Write-Host "Cleaning temporary files..." -ForegroundColor Yellow
    Remove-Item -Path $tempDir -Recurse -Force

    # Show results
    Write-Host ""
    Write-Host "Upgrade package created successfully: $packageName.zip" -ForegroundColor Green
    if (Test-Path "$packageName.zip") {
        $fileSize = (Get-Item "$packageName.zip").Length
        $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
        Write-Host "File size: $fileSizeMB MB" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Upgrade package is ready!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ Failed to create upgrade package!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Clean up on error
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force
    }
    
    exit 1
}

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")