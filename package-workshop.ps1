$ErrorActionPreference = 'Stop'

$workshop = Join-Path $PSScriptRoot 'field-workshop'
$output = Join-Path $PSScriptRoot 'dist'
$archive = Join-Path $output 'northstar-workshop.zip'
$legacyArchive = Join-Path $output 'northstar-workshop-windows.zip'
$macLaunchers = @('start.command', 'stop.command')
$launchers = @('start.bat', 'stop.bat') + $macLaunchers

if (-not (Test-Path -LiteralPath (Join-Path $workshop 'compose.yaml'))) {
  throw 'The field-workshop directory is missing.'
}
foreach ($name in $launchers) {
  $path = Join-Path $PSScriptRoot $name
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing launcher: $name" }
  if ($macLaunchers -notcontains $name) { continue }
  $content = [IO.File]::ReadAllBytes($path)
  if ([Text.Encoding]::ASCII.GetString($content, 0, [Math]::Min(11, $content.Length)) -ne '#!/bin/bash') {
    throw "Mac launcher has no valid shell header: $name"
  }
  if ($content -contains 13) { throw "Mac launcher must use LF line endings: $name" }
}
New-Item -ItemType Directory -Path $output -Force | Out-Null
Compress-Archive -Path (Join-Path $workshop '*') -DestinationPath $archive -Force

# ZIPs made on Windows normally omit Unix executable permissions. Mark the Mac
# launchers as regular, executable files and set their ZIP creator OS to Unix.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open($archive, [IO.Compression.ZipArchiveMode]::Update)
try {
  foreach ($name in $launchers) {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $PSScriptRoot $name), $name) | Out-Null
  }
  foreach ($name in $macLaunchers) {
    $entry = $zip.GetEntry($name)
    if ($null -eq $entry) { throw "Missing Mac launcher in package: $name" }
    $entry.ExternalAttributes = (0x81ED -shl 16) # regular file, mode 0755
  }
} finally {
  $zip.Dispose()
}

$bytes = [IO.File]::ReadAllBytes($archive)
$eocd = -1
for ($i = $bytes.Length - 22; $i -ge [Math]::Max(0, $bytes.Length - 65557); $i--) {
  if ($bytes[$i] -eq 0x50 -and $bytes[$i + 1] -eq 0x4b -and $bytes[$i + 2] -eq 0x05 -and $bytes[$i + 3] -eq 0x06) {
    $eocd = $i
    break
  }
}
if ($eocd -lt 0) { throw 'ZIP end-of-central-directory record not found.' }

$count = [BitConverter]::ToUInt16($bytes, $eocd + 10)
$cursor = [int][BitConverter]::ToUInt32($bytes, $eocd + 16)
$marked = @{}
for ($i = 0; $i -lt $count; $i++) {
  if ($bytes[$cursor] -ne 0x50 -or $bytes[$cursor + 1] -ne 0x4b -or $bytes[$cursor + 2] -ne 0x01 -or $bytes[$cursor + 3] -ne 0x02) {
    throw 'Invalid ZIP central directory.'
  }
  $nameLength = [BitConverter]::ToUInt16($bytes, $cursor + 28)
  $extraLength = [BitConverter]::ToUInt16($bytes, $cursor + 30)
  $commentLength = [BitConverter]::ToUInt16($bytes, $cursor + 32)
  $name = [Text.Encoding]::UTF8.GetString($bytes, $cursor + 46, $nameLength)
  if ($macLaunchers -contains $name) {
    $bytes[$cursor + 5] = 3 # ZIP creator OS: Unix
    $marked[$name] = $true
  }
  $cursor += 46 + $nameLength + $extraLength + $commentLength
}
foreach ($name in $macLaunchers) {
  if (-not $marked.ContainsKey($name)) { throw "Mac launcher permissions not set: $name" }
}
[IO.File]::WriteAllBytes($archive, $bytes)

# Preserve the earlier download name while moving new distributions to the
# platform-neutral name. Both packages contain both launchers.
Copy-Item -LiteralPath $archive -Destination $legacyArchive -Force
Write-Output "Package ready: $archive"
