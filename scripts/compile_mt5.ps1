[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$MetaEditorPath,

    [Parameter()]
    [switch]$RequireProductSources
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$includeRoot = Join-Path $repoRoot "MQL5"
$editor = (Resolve-Path $MetaEditorPath).Path

if (-not (Test-Path -LiteralPath $editor -PathType Leaf)) {
    throw "MetaEditor executable not found: $MetaEditorPath"
}

$sourceFiles = @(
    (Join-Path $includeRoot "Experts\FiduLync_Supervisor_Probe.mq5"),
    (Join-Path $includeRoot "Experts\FiduLync_Integration_Compile_Check.mq5")
)

# Product EA sources belong here. The folder is intentionally empty until the
# owner adds the real .mq5 product sources; no placeholder EA is compiled as a release.
$productSourceRoot = Join-Path $includeRoot "Experts\Release"
$productSources = @()
if (Test-Path -LiteralPath $productSourceRoot -PathType Container) {
    $productSources = @(Get-ChildItem -LiteralPath $productSourceRoot -Filter "*.mq5" -File -Recurse |
        ForEach-Object { $_.FullName })
}
if ($RequireProductSources -and $productSources.Count -eq 0) {
    throw "No product EA sources found in $productSourceRoot. Add the actual .mq5 release sources before using -RequireProductSources."
}
$sourceFiles = @($sourceFiles) + @($productSources)
if ($productSources.Count -gt 0) {
    Write-Host "Product EA sources discovered: $($productSources.Count)"
}

$failures = [System.Collections.Generic.List[string]]::new()

foreach ($source in $sourceFiles) {
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        $failures.Add("Missing source file: $source")
        continue
    }

    $base = [System.IO.Path]::Combine(
        [System.IO.Path]::GetDirectoryName($source),
        [System.IO.Path]::GetFileNameWithoutExtension($source)
    )
    $logPath = "$base.log"
    $ex5Path = "$base.ex5"

    Remove-Item -LiteralPath $logPath, $ex5Path -Force -ErrorAction SilentlyContinue

    # MetaEditor is the authoritative MQL5 compiler. /include points to the repo's
    # MQL5 root so <FiduLync/...> resolves from MQL5\Include\FiduLync.
    $arguments = '/compile:"{0}" /include:"{1}" /log' -f $source, $includeRoot
    $process = Start-Process -FilePath $editor -ArgumentList $arguments -Wait -PassThru

    if (-not (Test-Path -LiteralPath $logPath -PathType Leaf)) {
        $failures.Add("MetaEditor did not create a compilation log for $source (process exit $($process.ExitCode)).")
        continue
    }

    $reader = [System.IO.StreamReader]::new($logPath, $true)
    try {
        $logText = $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
    }

    $result = [regex]::Match(
        $logText,
        'Result:\s*(\d+)\s+errors?,\s*(\d+)\s+warnings?',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    if (-not $result.Success) {
        $failures.Add("Compilation result line missing or unrecognized for $source. Inspect $logPath.")
        continue
    }

    $errors = [int]$result.Groups[1].Value
    $warnings = [int]$result.Groups[2].Value

    if ($errors -ne 0 -or $warnings -ne 0) {
        $failures.Add("$source compiled with $errors error(s) and $warnings warning(s). See $logPath.")
        continue
    }

    if (-not (Test-Path -LiteralPath $ex5Path -PathType Leaf)) {
        $failures.Add("MetaEditor reported a clean result but did not create $ex5Path.")
        continue
    }

    Write-Host "PASS: $([System.IO.Path]::GetFileName($source)) — 0 errors, 0 warnings"
}

if ($failures.Count -gt 0) {
    Write-Error ($failures -join [Environment]::NewLine)
    exit 1
}

Write-Host "MQL5 compile gate passed. All discovered product sources and compile fixtures reported 0 errors and 0 warnings. EX5 files remain local outputs until uploaded and explicitly approved in the owner release console."
exit 0
