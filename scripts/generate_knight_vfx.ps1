Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $repoRoot 'public\vfx\knight'
$frameSize = 96
$gridSize = 32
$upscale = [int]($frameSize / $gridSize)

if (-not (Test-Path -LiteralPath $outDir)) {
  New-Item -ItemType Directory -Path $outDir | Out-Null
}

function New-Color([string]$hex, [int]$alpha = 255) {
  $hex = $hex.TrimStart('#')
  return [System.Drawing.Color]::FromArgb(
    $alpha,
    [Convert]::ToInt32($hex.Substring(0, 2), 16),
    [Convert]::ToInt32($hex.Substring(2, 2), 16),
    [Convert]::ToInt32($hex.Substring(4, 2), 16)
  )
}

$palette = @{
  steel = (New-Color '#a8dadc')
  holy = (New-Color '#fde68a')
  command = (New-Color '#fbbf24')
  barrier = (New-Color '#93c5fd')
  rally = (New-Color '#f59e0b')
  white = (New-Color '#f8fafc')
  deep = (New-Color '#1e3a5f')
}

function New-Frame {
  return New-Object System.Drawing.Bitmap($gridSize, $gridSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}

function New-Brush([System.Drawing.Color]$color) {
  return New-Object System.Drawing.SolidBrush($color)
}

function New-Pen([System.Drawing.Color]$color, [float]$width = 1) {
  $pen = New-Object System.Drawing.Pen($color, $width)
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function Scale-Frame([System.Drawing.Bitmap]$frame) {
  $scaled = New-Object System.Drawing.Bitmap($frameSize, $frameSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($scaled)
  try {
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $graphics.DrawImage($frame, 0, 0, $frameSize, $frameSize)
  }
  finally {
    $graphics.Dispose()
  }
  return $scaled
}

function Save-Strip([string]$name, [System.Collections.Generic.List[System.Drawing.Bitmap]]$frames) {
  $stripWidth = [int]($frameSize * $frames.Count)
  $strip = New-Object System.Drawing.Bitmap($stripWidth, $frameSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($strip)
  try {
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    for ($i = 0; $i -lt $frames.Count; $i++) {
      $scaled = Scale-Frame $frames[$i]
      try {
        $graphics.DrawImage($scaled, $i * $frameSize, 0, $frameSize, $frameSize)
      }
      finally {
        $scaled.Dispose()
      }
    }
  }
  finally {
    $graphics.Dispose()
  }

  $path = Join-Path $outDir "$name.png"
  try {
    $strip.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $strip.Dispose()
  }
}

function Draw-Pixel([System.Drawing.Graphics]$graphics, [System.Drawing.Color]$color, [int]$x, [int]$y, [int]$w = 1, [int]$h = 1) {
  $brush = New-Brush $color
  try {
    $graphics.FillRectangle($brush, $x, $y, $w, $h)
  }
  finally {
    $brush.Dispose()
  }
}

function Draw-Ring([System.Drawing.Graphics]$graphics, [System.Drawing.Color]$color, [int]$cx, [int]$cy, [int]$radius, [int]$thickness = 1) {
  for ($offset = 0; $offset -lt $thickness; $offset++) {
    $pen = New-Pen $color 1
    try {
      $r = $radius - $offset
      $graphics.DrawEllipse($pen, $cx - $r, $cy - $r, $r * 2, $r * 2)
    }
    finally {
      $pen.Dispose()
    }
  }
}

function Add-HolyRebukeFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 6; $idx++) {
    $frame = New-Frame
    $graphics = [System.Drawing.Graphics]::FromImage($frame)
    try {
      Draw-Ring $graphics $palette.holy 16 16 (4 + $idx * 2) 2
      Draw-Ring $graphics $palette.steel 16 16 (2 + $idx * 2) 1
      for ($ray = 0; $ray -lt 8; $ray++) {
        $dxs = @(0, 3, 5, 3, 0, -3, -5, -3)
        $dys = @(-6, -4, 0, 4, 6, 4, 0, -4)
        $sx = 16 + $dxs[$ray] * ($idx + 1) / 2
        $sy = 16 + $dys[$ray] * ($idx + 1) / 2
        Draw-Pixel $graphics $palette.white ([int][Math]::Round($sx)) ([int][Math]::Round($sy)) 2 2
      }
      Draw-Pixel $graphics $palette.deep 15 12 2 8
      Draw-Pixel $graphics $palette.deep 12 15 8 2
      $frames.Add($frame)
    }
    finally {
      $graphics.Dispose()
    }
  }
  return $frames
}

function Add-ValorousStrikeFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 5; $idx++) {
    $frame = New-Frame
    $graphics = [System.Drawing.Graphics]::FromImage($frame)
    try {
      for ($slash = 0; $slash -lt 3; $slash++) {
        $startX = 8 + $slash * 3 + $idx * 2
        $startY = 22 - $slash * 4
        $pen = New-Pen $palette.steel 2
        $edgePen = New-Pen $palette.white 1
        try {
          $graphics.DrawLine($pen, $startX, $startY, $startX + 11, $startY - 11)
          $graphics.DrawLine($edgePen, $startX + 1, $startY, $startX + 10, $startY - 10)
        }
        finally {
          $pen.Dispose()
          $edgePen.Dispose()
        }
      }
      for ($spark = 0; $spark -le $idx; $spark++) {
        Draw-Pixel $graphics $palette.holy (20 + $spark * 2) (10 + ($spark % 3) * 3)
      }
      $frames.Add($frame)
    }
    finally {
      $graphics.Dispose()
    }
  }
  return $frames
}

function Add-TauntFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 6; $idx++) {
    $frame = New-Frame
    $graphics = [System.Drawing.Graphics]::FromImage($frame)
    try {
      Draw-Ring $graphics $palette.command 16 16 (5 + $idx * 2) 2
      Draw-Ring $graphics $palette.holy 16 16 (2 + $idx * 2) 1
      Draw-Pixel $graphics $palette.command 15 8 2 10
      Draw-Pixel $graphics $palette.command 13 16 6 2
      Draw-Pixel $graphics $palette.holy 11 11 2 2
      Draw-Pixel $graphics $palette.holy 19 11 2 2
      for ($pip = 0; $pip -lt $idx; $pip++) {
        Draw-Pixel $graphics $palette.white (7 + $pip * 3) 6
        Draw-Pixel $graphics $palette.white (7 + $pip * 3) 25
      }
      $frames.Add($frame)
    }
    finally {
      $graphics.Dispose()
    }
  }
  return $frames
}

function Add-ShieldWallFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 6; $idx++) {
    $frame = New-Frame
    $graphics = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $radius = 6 + $idx * 2
      Draw-Ring $graphics $palette.barrier 16 17 $radius 2
      Draw-Ring $graphics $palette.white 16 17 ($radius - 2) 1
      Draw-Pixel $graphics $palette.deep 14 9 4 12
      Draw-Pixel $graphics $palette.deep 12 12 8 8
      Draw-Pixel $graphics $palette.white 15 11 2 8
      Draw-Pixel $graphics $palette.white 13 14 6 2
      for ($spark = 0; $spark -lt ($idx + 1); $spark++) {
        Draw-Pixel $graphics $palette.steel (8 + $spark * 3) (24 - ($spark % 2) * 3)
      }
      $frames.Add($frame)
    }
    finally {
      $graphics.Dispose()
    }
  }
  return $frames
}

function Add-LastStandFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 8; $idx++) {
    $frame = New-Frame
    $graphics = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $radius = 5 + $idx * 2
      Draw-Ring $graphics $palette.rally 16 16 $radius 2
      Draw-Ring $graphics $palette.holy 16 16 ($radius - 2) 1
      Draw-Pixel $graphics $palette.white 15 6 2 20
      Draw-Pixel $graphics $palette.white 11 15 10 2
      Draw-Pixel $graphics $palette.rally 13 10 6 2
      Draw-Pixel $graphics $palette.rally 14 18 4 2
      for ($flare = 0; $flare -lt 4; $flare++) {
        $offsets = @(
          @{ x = 0; y = -($radius + 1) },
          @{ x = $radius + 1; y = 0 },
          @{ x = 0; y = $radius + 1 },
          @{ x = -($radius + 1); y = 0 }
        )
        $offset = $offsets[$flare]
        Draw-Pixel $graphics $palette.holy (16 + $offset.x) (16 + $offset.y) 2 2
      }
      $frames.Add($frame)
    }
    finally {
      $graphics.Dispose()
    }
  }
  return $frames
}

$generated = @(
  @{ Name = 'holy_rebuke_burst'; Frames = (Add-HolyRebukeFrames) }
  @{ Name = 'valorous_strike_impact'; Frames = (Add-ValorousStrikeFrames) }
  @{ Name = 'taunt_shout'; Frames = (Add-TauntFrames) }
  @{ Name = 'shield_wall_barrier'; Frames = (Add-ShieldWallFrames) }
  @{ Name = 'last_stand_aura'; Frames = (Add-LastStandFrames) }
)

foreach ($entry in $generated) {
  try {
    Save-Strip $entry.Name $entry.Frames
  }
  finally {
    foreach ($frame in $entry.Frames) {
      $frame.Dispose()
    }
  }
}

Write-Output "Wrote Knight VFX strips to $outDir"
