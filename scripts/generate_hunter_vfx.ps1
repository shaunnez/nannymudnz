Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $repoRoot 'public\vfx\hunter'
$frameSize = 96
$gridSize = 32
$largeFrame = 160
$largeGrid = 40

if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

function New-Color([string]$hex, [int]$alpha = 255) {
  $hex = $hex.TrimStart('#')
  return [System.Drawing.Color]::FromArgb($alpha,
    [Convert]::ToInt32($hex.Substring(0,2),16),
    [Convert]::ToInt32($hex.Substring(2,2),16),
    [Convert]::ToInt32($hex.Substring(4,2),16))
}

$pal = @{
  brown  = (New-Color '#8d6e63')
  lime   = (New-Color '#a3e635')
  lgreen = (New-Color '#d9f99d')
  amber  = (New-Color '#fbbf24')
  smoke  = (New-Color '#78716c')
  white  = (New-Color '#f7fee7')
  dark   = (New-Color '#1c1917')
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

function Add-DisengageBurstFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 6; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 4 + $idx * 2
      Draw-Ring $g $pal.lime  16 16 $r 2
      Draw-Ring $g $pal.smoke 16 16 ($r + 2) 1
      for ($i = 0; $i -lt 4; $i++) {
        $angle = [Math]::PI * 2 / 4 * $i + $idx * 0.4
        $dx = [int]([Math]::Round([Math]::Cos($angle) * ($r + 3)))
        $dy = [int]([Math]::Round([Math]::Sin($angle) * ($r + 3)))
        Draw-Pixel $g $pal.lgreen (16+$dx) (16+$dy) 2 2
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-BearTrapSnapFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 5; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      Draw-Ring $g $pal.brown 16 20 (4 + $idx) 2
      $pen = New-Pen $pal.dark 2
      try {
        $g.DrawLine($pen, 8, 20, 24, 20)
      } finally { $pen.Dispose() }
      Draw-Pixel $g $pal.amber 15 19 2 2
      for ($i = 0; $i -lt $idx; $i++) {
        Draw-Pixel $g $pal.lgreen (8 + $i * 4) (12 + ($i % 2) * 4)
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-RainPulseFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 7; $idx++) {
    $frame = New-Frame $largeGrid; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 6 + $idx * 2
      Draw-Ring $g $pal.lime 20 20 $r 1
      for ($i = 0; $i -lt 5; $i++) {
        $x = 8 + $i * 4
        $y = 4 + ($idx + $i) % 8 * 2
        Draw-Pixel $g $pal.lgreen $x $y 1 3
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

$generated = @(
  @{ Name = 'disengage_burst'; Frames = (Add-DisengageBurstFrames); Size = $frameSize  }
  @{ Name = 'bear_trap_snap';  Frames = (Add-BearTrapSnapFrames);   Size = $frameSize  }
  @{ Name = 'rain_pulse';      Frames = (Add-RainPulseFrames);      Size = $largeFrame }
)
foreach ($e in $generated) {
  try { Save-Strip $e.Name $e.Frames $e.Size }
  finally { foreach ($f in $e.Frames) { $f.Dispose() } }
}
Write-Output "Wrote Hunter VFX strips to $outDir"
