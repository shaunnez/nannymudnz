Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $repoRoot 'public\vfx\champion'
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
  red    = (New-Color '#a71d2a')
  blood  = (New-Color '#dc2626')
  dark   = (New-Color '#450a0a')
  pale   = (New-Color '#fca5a5')
  gold   = (New-Color '#fbbf24')
  white  = (New-Color '#fef2f2')
  near   = (New-Color '#7f1d1d')
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

function Add-ChargeImpactFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 5; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      for ($sl = 0; $sl -lt 3; $sl++) {
        $sx = 6 + $sl * 3 + $idx * 2; $sy = 20 - $sl * 3
        $pen = New-Pen $pal.blood 2; $lite = New-Pen $pal.pale 1
        try {
          $g.DrawLine($pen, $sx, $sy, $sx + 12, $sy - 10)
          $g.DrawLine($lite, $sx + 1, $sy, $sx + 11, $sy - 9)
        } finally { $pen.Dispose(); $lite.Dispose() }
      }
      for ($sp = 0; $sp -le $idx; $sp++) { Draw-Pixel $g $pal.white (20 + $sp * 2) (10 + ($sp % 3) * 3) }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-ExecuteImpactFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 5; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $pen = New-Pen $pal.near 3; $lite = New-Pen $pal.blood 2
      try {
        $g.DrawLine($pen, 8, 6 + $idx, 20, 26 - $idx)
        $g.DrawLine($lite, 12, 6 + $idx, 24, 26 - $idx)
      } finally { $pen.Dispose(); $lite.Dispose() }
      for ($i = 0; $i -lt 3; $i++) { Draw-Pixel $g $pal.blood (12 + $i * 4) (20 + $i * 3) }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-CleaverImpactFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 5; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      for ($sl = 0; $sl -lt 2; $sl++) {
        $sx = 8 + $sl * 4 + $idx * 2; $sy = 18 - $sl * 5
        $pen = New-Pen $pal.red 2
        try { $g.DrawLine($pen, $sx, $sy, $sx + 10, $sy - 10) } finally { $pen.Dispose() }
      }
      for ($sp = 0; $sp -le $idx; $sp++) { Draw-Pixel $g $pal.pale (18 + $sp * 2) (12 + ($sp % 2) * 4) }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-SkullsplitterFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 8; $idx++) {
    $frame = New-Frame $largeGrid; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 4 + $idx * 2
      Draw-Ring $g $pal.dark  20 20 $r 3
      Draw-Ring $g $pal.blood 20 20 ($r + 2) 1
      for ($i = 0; $i -lt 4; $i++) {
        $angle = [Math]::PI * 2 / 4 * $i + $idx * 0.3
        $dx = [int]([Math]::Round([Math]::Cos($angle) * ($r + 4)))
        $dy = [int]([Math]::Round([Math]::Sin($angle) * ($r + 4)))
        Draw-Pixel $g $pal.gold (20+$dx) (20+$dy) 2 2
      }
      Draw-Pixel $g $pal.white 19 19 2 2
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-TitheGlowFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 6; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 4 + $idx * 2
      Draw-Ring $g $pal.blood 16 16 $r 2
      Draw-Ring $g $pal.pale  16 16 ($r - 2) 1
      for ($i = 0; $i -lt ($idx + 1); $i++) { Draw-Pixel $g $pal.white (8 + $i * 3) (6 + ($i % 2) * 3) }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-ChallengeMarkFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 5; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 4 + $idx * 2
      Draw-Ring $g $pal.red  16 16 $r 2
      Draw-Ring $g $pal.gold 16 16 ($r - 2) 1
      Draw-Pixel $g $pal.white 15 10 2 12
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

$generated = @(
  @{ Name = 'charge_impact';    Frames = (Add-ChargeImpactFrames);    Size = $frameSize  }
  @{ Name = 'execute_impact';   Frames = (Add-ExecuteImpactFrames);   Size = $frameSize  }
  @{ Name = 'cleaver_impact';   Frames = (Add-CleaverImpactFrames);   Size = $frameSize  }
  @{ Name = 'skullsplitter_burst'; Frames = (Add-SkullsplitterFrames); Size = $largeFrame }
  @{ Name = 'tithe_glow';       Frames = (Add-TitheGlowFrames);       Size = $frameSize  }
  @{ Name = 'challenge_mark';   Frames = (Add-ChallengeMarkFrames);   Size = $frameSize  }
)
foreach ($e in $generated) {
  try { Save-Strip $e.Name $e.Frames $e.Size }
  finally { foreach ($f in $e.Frames) { $f.Dispose() } }
}
Write-Output "Wrote Champion VFX strips to $outDir"
