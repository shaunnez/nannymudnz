Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $repoRoot 'public\vfx\vampire'
$frameSize = 96
$gridSize = 32

if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

function New-Color([string]$hex, [int]$alpha = 255) {
  $hex = $hex.TrimStart('#')
  return [System.Drawing.Color]::FromArgb($alpha,
    [Convert]::ToInt32($hex.Substring(0,2),16),
    [Convert]::ToInt32($hex.Substring(2,2),16),
    [Convert]::ToInt32($hex.Substring(4,2),16))
}

$pal = @{
  deep    = (New-Color '#7a1935')
  crimson = (New-Color '#dc2626')
  pale    = (New-Color '#fca5a5')
  shadow  = (New-Color '#1e1b4b')
  white   = (New-Color '#fff1f2')
  dark    = (New-Color '#0f172a')
}

function New-Brush($c) { return New-Object System.Drawing.SolidBrush($c) }
function New-Pen($c, [float]$w = 1) {
  $p = New-Object System.Drawing.Pen($c, $w)
  $p.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $p
}
function New-Frame([int]$size = $gridSize) {
  return New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}
function Scale-Frame([System.Drawing.Bitmap]$f, [int]$target = $frameSize) {
  $s = New-Object System.Drawing.Bitmap($target, $target, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($s)
  try {
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $g.DrawImage($f, 0, 0, $target, $target)
  } finally { $g.Dispose() }
  return $s
}
function Save-Strip([string]$name, $frames, [int]$target = $frameSize) {
  $strip = New-Object System.Drawing.Bitmap(($target * $frames.Count), $target, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($strip)
  try {
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    for ($i = 0; $i -lt $frames.Count; $i++) {
      $sc = Scale-Frame $frames[$i] $target
      try { $g.DrawImage($sc, $i * $target, 0, $target, $target) } finally { $sc.Dispose() }
    }
  } finally { $g.Dispose() }
  $path = Join-Path $outDir "$name.png"
  try { $strip.Save($path, [System.Drawing.Imaging.ImageFormat]::Png) } finally { $strip.Dispose() }
}
function Draw-Pixel($g, $c, [int]$x, [int]$y, [int]$w = 1, [int]$h = 1) {
  $b = New-Brush $c
  try { $g.FillRectangle($b, $x, $y, $w, $h) } finally { $b.Dispose() }
}
function Draw-Ring($g, $c, [int]$cx, [int]$cy, [int]$r, [int]$t = 1) {
  for ($o = 0; $o -lt $t; $o++) {
    $p = New-Pen $c 1
    try { $g.DrawEllipse($p, $cx-($r-$o), $cy-($r-$o), ($r-$o)*2, ($r-$o)*2) } finally { $p.Dispose() }
  }
}

function Add-BloodDrainFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 6; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 10 - $idx
      if ($r -gt 2) { Draw-Ring $g $pal.pale 16 16 $r 2 }
      Draw-Ring $g $pal.crimson 16 16 (4 + $idx) 1
      for ($i = 0; $i -lt ($idx + 1); $i++) {
        Draw-Pixel $g $pal.pale (8 + $i * 3) (6 + ($i % 2) * 3)
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-FangStrikeFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 5; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $pen1 = New-Pen $pal.deep 2; $pen2 = New-Pen $pal.crimson 2
      try {
        $g.DrawLine($pen1, 8,  6+$idx, 16, 22+$idx)
        $g.DrawLine($pen2, 16, 6+$idx, 24, 22+$idx)
      } finally { $pen1.Dispose(); $pen2.Dispose() }
      Draw-Pixel $g $pal.pale (15) (22+$idx) 3 3
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-NocturneAuraFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  $largeGrid = 40; $largeFrame = 160
  for ($idx = 0; $idx -lt 8; $idx++) {
    $frame = New-Object System.Drawing.Bitmap($largeGrid, $largeGrid, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 5 + $idx * 2
      Draw-Ring $g $pal.deep    20 20 $r 2
      Draw-Ring $g $pal.crimson 20 20 ($r - 2) 1
      for ($i = 0; $i -lt 3; $i++) {
        $angle = [Math]::PI * 2 / 3 * $i + $idx * 0.5
        $dx = [int]([Math]::Round([Math]::Cos($angle) * ($r + 1)))
        $dy = [int]([Math]::Round([Math]::Sin($angle) * ($r + 1)))
        Draw-Pixel $g $pal.pale (20+$dx) (20+$dy) 2 2
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  # Save at 160px
  $strip = New-Object System.Drawing.Bitmap(($largeFrame * $frames.Count), $largeFrame, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($strip)
  try {
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    for ($i = 0; $i -lt $frames.Count; $i++) {
      $sc = New-Object System.Drawing.Bitmap($largeFrame, $largeFrame, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $sg = [System.Drawing.Graphics]::FromImage($sc)
      try {
        $sg.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $sg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
        $sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
        $sg.DrawImage($frames[$i], 0, 0, $largeFrame, $largeFrame)
      } finally { $sg.Dispose() }
      try { $g.DrawImage($sc, $i * $largeFrame, 0, $largeFrame, $largeFrame) } finally { $sc.Dispose() }
    }
  } finally { $g.Dispose() }
  $path = Join-Path $outDir 'nocturne_aura.png'
  try { $strip.Save($path, [System.Drawing.Imaging.ImageFormat]::Png) } finally { $strip.Dispose() }
  foreach ($f in $frames) { $f.Dispose() }
}

# Generate 96px strips
$gen96 = @(
  @{ Name = 'blood_drain_glow';  Frames = (Add-BloodDrainFrames)  }
  @{ Name = 'fang_strike_impact'; Frames = (Add-FangStrikeFrames) }
)
foreach ($e in $gen96) {
  try { Save-Strip $e.Name $e.Frames $frameSize }
  finally { foreach ($f in $e.Frames) { $f.Dispose() } }
}

# Generate 160px nocturne separately
Add-NocturneAuraFrames

Write-Output "Wrote Vampire VFX strips to $outDir"
