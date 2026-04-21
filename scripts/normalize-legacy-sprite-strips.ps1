param(
  [Parameter(Mandatory = $true)]
  [string]$GuildId,
  [int]$TargetSize = 124,
  [ValidateSet('scale', 'pad')]
  [string]$Mode = 'pad',
  [string]$SourceDir,
  [double]$ScaleFactor = 1.0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$spriteDir = Join-Path $repoRoot "public\sprites\$GuildId"
$metaPath = Join-Path $spriteDir 'metadata.json'

if (-not (Test-Path -LiteralPath $metaPath)) {
  throw "Missing metadata: $metaPath"
}

$meta = Get-Content -Raw -LiteralPath $metaPath | ConvertFrom-Json
$sourceMeta = $meta
$sourceSpriteDir = $spriteDir

if ($SourceDir) {
  $sourceSpriteDir = $SourceDir
  $sourceMetaPath = Join-Path $sourceSpriteDir 'metadata.json'
  if (-not (Test-Path -LiteralPath $sourceMetaPath)) {
    throw "Missing source metadata: $sourceMetaPath"
  }
  $sourceMeta = Get-Content -Raw -LiteralPath $sourceMetaPath | ConvertFrom-Json
}

$sourceFrameWidth = [int]$sourceMeta.frameSize.w
$sourceFrameHeight = [int]$sourceMeta.frameSize.h
$targetAnchorX = [int]($TargetSize / 2)
$targetAnchorY = $TargetSize - 12

foreach ($animationName in $meta.animations.PSObject.Properties.Name) {
  $animMeta = $meta.animations.$animationName
  $sourceAnimMeta = $sourceMeta.animations.$animationName
  $frames = [int]$sourceAnimMeta.frames
  $framesInt = [int]$frames
  $sourcePath = Join-Path $sourceSpriteDir "$animationName.png"
  $outputPath = Join-Path $spriteDir "$animationName.png"
  $tempPath = Join-Path $spriteDir "$animationName.normalized.tmp.png"

  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing sprite strip: $sourcePath"
  }

  $bitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)
  try {
    $expectedWidth = [int]($sourceFrameWidth * $framesInt)
    if ($bitmap.Width -ne $expectedWidth -or $bitmap.Height -ne $sourceFrameHeight) {
      throw "Unexpected size for ${animationName}: $($bitmap.Width)x$($bitmap.Height); expected ${expectedWidth}x$sourceFrameHeight"
    }

    $destWidth = [int]($TargetSize * $framesInt)
    $destBitmap = New-Object System.Drawing.Bitmap($destWidth, $TargetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($destBitmap)
      try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None

        if ($Mode -eq 'scale') {
          $graphics.DrawImage($bitmap, 0, 0, $destWidth, $TargetSize)
        }
        else {
          $scaledFrameWidth = [int][Math]::Round($sourceFrameWidth * $ScaleFactor)
          $scaledFrameHeight = [int][Math]::Round($sourceFrameHeight * $ScaleFactor)
          $scaledAnchorX = [int][Math]::Round([int]$sourceAnimMeta.anchor.x * $ScaleFactor)
          $scaledAnchorY = [int][Math]::Round([int]$sourceAnimMeta.anchor.y * $ScaleFactor)
          $offsetX = $targetAnchorX - $scaledAnchorX
          $offsetY = $targetAnchorY - $scaledAnchorY

          for ($frameIndex = 0; $frameIndex -lt $framesInt; $frameIndex++) {
            $srcX = [int]($frameIndex * $sourceFrameWidth)
            $dstX = [int](($frameIndex * $TargetSize) + $offsetX)
            $srcRect = New-Object System.Drawing.Rectangle($srcX, 0, $sourceFrameWidth, $sourceFrameHeight)
            $dstRect = New-Object System.Drawing.Rectangle($dstX, $offsetY, $scaledFrameWidth, $scaledFrameHeight)
            $graphics.DrawImage($bitmap, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
          }
        }
      }
      finally {
        $graphics.Dispose()
      }

      $destBitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $destBitmap.Dispose()
    }
  }
  finally {
    $bitmap.Dispose()
  }

  Move-Item -LiteralPath $tempPath -Destination $outputPath -Force

  $animMeta.frames = $framesInt
  $animMeta.frameDurationMs = [int]$sourceAnimMeta.frameDurationMs
  $animMeta.loop = [bool]$sourceAnimMeta.loop
  $animMeta.anchor.x = $targetAnchorX
  $animMeta.anchor.y = $targetAnchorY
}

$meta.frameSize.w = $TargetSize
$meta.frameSize.h = $TargetSize

$json = $meta | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($metaPath, $json + [Environment]::NewLine, [System.Text.Encoding]::UTF8)

Write-Output "Normalized $GuildId sprite strips to ${TargetSize}x${TargetSize} using mode '$Mode'"
