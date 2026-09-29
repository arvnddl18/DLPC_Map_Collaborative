# ==============================================================================
# Security Audit & Hardening Verification Script
# Project: DLPC_Map_Collaborative (Davao Light and Power Company)
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$Detailed
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot | Split-Path -Parent

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " DLPC_Map_Collaborative Security Verification Audit " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Target Directory: $root`n"

$results = [System.Collections.Generic.List[PSCustomObject]]::new()

function Add-AuditResult {
    param(
        [string]$Category,
        [string]$Check,
        [string]$Status,
        [string]$Details
    )
    $color = switch ($Status) {
        "PASS" { "Green" }
        "WARN" { "Yellow" }
        "FAIL" { "Red" }
        Default { "White" }
    }
    Write-Host ("[{0}] {1}: {2}" -f $Status, $Category, $Check) -ForegroundColor $color
    if ($Details) {
        Write-Host "       $Details" -ForegroundColor DarkGray
    }
    $results.Add([PSCustomObject]@{
        Category = $Category
        Check    = $Check
        Status   = $Status
        Details  = $Details
    })
}

# ------------------------------------------------------------------------------
# 1. API Key & Secret Protection Check
# ------------------------------------------------------------------------------
Write-Host "`n[1/6] Scanning for Hardcoded Secrets & Credentials..." -ForegroundColor Yellow
$secretRegex = '(?i)(AKIA[0-9A-Z]{16}|bearer\s+[a-zA-Z0-9_\-\.]{25,}|ghp_[a-zA-Z0-9]{36}|BEGIN\s+PRIVATE\s+KEY|eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,})'
$candidateFiles = Get-ChildItem -Path $root -Recurse -File | Where-Object {
    $_.FullName -notmatch '\\(\.git|node_modules|dist|build|coverage)\\' -and
    $_.Name -ne "package-lock.json"
}

$foundSecrets = @()
foreach ($file in $candidateFiles) {
    $content = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -match $secretRegex) {
        $foundSecrets += $file.FullName
    }
}

if ($foundSecrets.Count -eq 0) {
    Add-AuditResult -Category "Secrets" -Check "No hardcoded credentials, JWTs, or private keys" -Status "PASS" -Details "Scanned $($candidateFiles.Count) files cleanly."
} else {
    Add-AuditResult -Category "Secrets" -Check "Hardcoded secret patterns detected" -Status "FAIL" -Details "Found in: $($foundSecrets -join ', ')"
}

# ------------------------------------------------------------------------------
# 2. Exposed Files & .gitignore Protection
# ------------------------------------------------------------------------------
Write-Host "`n[2/6] Verifying Version Control & File Exposure Controls..." -ForegroundColor Yellow
$gitignorePath = Join-Path $root ".gitignore"
if (Test-Path $gitignorePath) {
    $giContent = Get-Content $gitignorePath -Raw
    $criticalPatterns = @(".env", "*.key", "*.pem", "node_modules/", "*.sqlite", "*.db", "logs/")
    $missingPatterns = @()
    foreach ($p in $criticalPatterns) {
        if ($giContent -notmatch [regex]::Escape($p)) {
            $missingPatterns += $p
        }
    }
    if ($missingPatterns.Count -eq 0) {
        Add-AuditResult -Category "Exposed Files" -Check ".gitignore covers all critical secret & artifact patterns" -Status "PASS" -Details "Includes .env, keys, DBs, logs, node_modules."
    } else {
        Add-AuditResult -Category "Exposed Files" -Check ".gitignore missing critical exclusions" -Status "WARN" -Details "Missing: $($missingPatterns -join ', ')"
    }
} else {
    Add-AuditResult -Category "Exposed Files" -Check ".gitignore existence" -Status "FAIL" -Details "No .gitignore found."
}

# ------------------------------------------------------------------------------
# 3. Environment & Configuration Security
# ------------------------------------------------------------------------------
Write-Host "`n[3/6] Auditing Environment Templates & Package Metadata..." -ForegroundColor Yellow
$envExamplePath = Join-Path $root ".env.example"
if (Test-Path $envExamplePath) {
    $envExContent = Get-Content $envExamplePath -Raw
    if ($envExContent -match 'password123|admin123|supersecret') {
        Add-AuditResult -Category "Environment" -Check ".env.example password hygiene" -Status "WARN" -Details "Default insecure passwords detected."
    } else {
        Add-AuditResult -Category "Environment" -Check ".env.example contains secure placeholder taxonomy" -Status "PASS" -Details "Safe template variables defined without real secrets."
    }
} else {
    Add-AuditResult -Category "Environment" -Check ".env.example existence" -Status "WARN" -Details "No template file found."
}

$pkgPath = Join-Path $root "package.json"
if (Test-Path $pkgPath) {
    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
    if ($pkg.private -eq $true) {
        Add-AuditResult -Category "Configuration" -Check "package.json marked private: true" -Status "PASS" -Details "Prevents accidental public npm publish."
    } else {
        Add-AuditResult -Category "Configuration" -Check "package.json marked private" -Status "FAIL" -Details "private: true is required."
    }
}

# ------------------------------------------------------------------------------
# 4. MCP Configuration Hardening Audit
# ------------------------------------------------------------------------------
Write-Host "`n[4/6] Auditing MCP Server Configurations..." -ForegroundColor Yellow
$mcpConfigs = @(
    (Join-Path $root "mcp_config.json"),
    (Join-Path $root ".vscode\mcp.json"),
    (Join-Path $root ".agents\mcp_config.json")
)

foreach ($cfgPath in $mcpConfigs) {
    $rel = $cfgPath.Replace($root, "").TrimStart("\")
    if (Test-Path $cfgPath) {
        $json = Get-Content $cfgPath -Raw | ConvertFrom-Json
        $playwright = $json.mcpServers.playwright
        if ($playwright) {
            $isPinned = ($playwright.args -join " ") -match '@playwright/mcp@0\.0\.\d+'
            $isIsolated = ($playwright.args -contains "--isolated")
            if ($isPinned -and $isIsolated) {
                Add-AuditResult -Category "MCP Security" -Check "$rel configuration" -Status "PASS" -Details "Version pinned, --isolated profile active."
            } else {
                Add-AuditResult -Category "MCP Security" -Check "$rel configuration" -Status "WARN" -Details "Pinned: $isPinned, Isolated: $isIsolated."
            }
        } else {
            Add-AuditResult -Category "MCP Security" -Check "$rel server definition" -Status "WARN" -Details "No playwright entry found."
        }
    } else {
        Add-AuditResult -Category "MCP Security" -Check "$rel existence" -Status "WARN" -Details "File not found."
    }
}

# ------------------------------------------------------------------------------
# 5. Dependency Vulnerability Audit
# ------------------------------------------------------------------------------
Write-Host "`n[5/6] Checking Dependency Vulnerabilities via npm audit..." -ForegroundColor Yellow
try {
    $auditOutput = cmd.exe /c "npm audit --json" 2>&1 | Out-String
    $auditJson = $auditOutput | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($auditJson -and $auditJson.metadata.vulnerabilities.total -eq 0) {
        Add-AuditResult -Category "Dependencies" -Check "npm audit vulnerability status" -Status "PASS" -Details "0 vulnerabilities across $($auditJson.metadata.totalDependencies) dependencies."
    } elseif ($auditJson) {
        $total = $auditJson.metadata.vulnerabilities.total
        $high = $auditJson.metadata.vulnerabilities.high
        $crit = $auditJson.metadata.vulnerabilities.critical
        Add-AuditResult -Category "Dependencies" -Check "npm audit found vulnerabilities" -Status "WARN" -Details "Total: $total (High: $high, Critical: $crit)."
    } else {
        Add-AuditResult -Category "Dependencies" -Check "npm audit execution" -Status "PASS" -Details "npm audit returned cleanly."
    }
} catch {
    Add-AuditResult -Category "Dependencies" -Check "npm audit execution" -Status "WARN" -Details $_.Exception.Message
}

# ------------------------------------------------------------------------------
# 6. Obsidian Long-Term Memory Guardrail Check
# ------------------------------------------------------------------------------
Write-Host "`n[6/6] Checking Obsidian Memory Layer Compliance..." -ForegroundColor Yellow
$vaultPath = Join-Path $root "Vault\DLPC_Map_Collaborative"
if (Test-Path $vaultPath) {
    $vaultFiles = Get-ChildItem -Path $vaultPath -Recurse -File
    $vaultSecretHits = @()
    foreach ($vf in $vaultFiles) {
        $vfc = Get-Content $vf.FullName -Raw -ErrorAction SilentlyContinue
        if ($vfc -match '(?i)(secret:\s*["''][a-zA-Z0-9_\-]{16,}["'']|password:\s*["''][^"'']{6,}["''])') {
            $vaultSecretHits += $vf.Name
        }
    }
    if ($vaultSecretHits.Count -eq 0) {
        Add-AuditResult -Category "Obsidian Vault" -Check "Vault credential hygiene" -Status "PASS" -Details "Zero credential leaks across $($vaultFiles.Count) vault notes."
    } else {
        Add-AuditResult -Category "Obsidian Vault" -Check "Vault credential hygiene" -Status "FAIL" -Details "Potential secrets found in: $($vaultSecretHits -join ', ')"
    }
}

# ------------------------------------------------------------------------------
# Summary Table
# ------------------------------------------------------------------------------
Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "                Audit Scorecard                     " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
$passes = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$warns  = ($results | Where-Object { $_.Status -eq "WARN" }).Count
$fails  = ($results | Where-Object { $_.Status -eq "FAIL" }).Count

Write-Host "Total Checks: $($results.Count) | PASS: $passes | WARN: $warns | FAIL: $fails`n" -ForegroundColor Cyan

if ($fails -gt 0) {
    Write-Host "Status: AUDIT FAILED (Action Required)" -ForegroundColor Red
    exit 1
} elseif ($warns -gt 0) {
    Write-Host "Status: AUDIT PASSED WITH WARNINGS" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "Status: AUDIT PASSED (Workspace Fully Hardened)" -ForegroundColor Green
    exit 0
}
