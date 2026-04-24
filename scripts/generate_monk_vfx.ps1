Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $repoRoot 'public\vfx\monk'
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
  gold   = (New-Color '#d9a441')
  chi    = (New-Color '#fcd34d')
  amber  = (New-Color '#f59e0b')
  strike = (New-Color '#ef4444')
  orange = (New-Color '#f97316')
  white  = (New-Color '#fffbeb')
  deep   = (New-Color '#1c1917')
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

function Add-SerenityAuraFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 7; $idx++) {
    $frame = New-Frame $largeGrid; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 5 + $idx * 2
      Draw-Ring $g $pal.chi  20 20 $r 2
      Draw-Ring $g $pal.gold 20 20 ($r - 2) 1
      for ($i = 0; $i -lt 5; $i++) {
        $angle = [Math]::PI * 2 / 5 * $i + $idx * 0.4
        $dx = [int]([Math]::Round([Math]::Cos($angle) * ($r + 1)))
        $dy = [int]([Math]::Round([Math]::Sin($angle) * ($r + 1)))
        Draw-Pixel $g $pal.white (20+$dx) (20+$dy) 2 2
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-FlyingKickFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 5; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      for ($sl = 0; $sl -lt 3; $sl++) {
        $sx = 6 + $sl * 3 + $idx * 2; $sy = 22 - $sl * 4
        $pen = New-Pen $pal.amber 2; $lite = New-Pen $pal.chi 1
        try {
          $g.DrawLine($pen, $sx, $sy, $sx + 12, $sy - 10)
          $g.DrawLine($lite, $sx + 1, $sy, $sx + 11, $sy - 9)
        } finally { $pen.Dispose(); $lite.Dispose() }
      }
      for ($sp = 0; $sp -le $idx; $sp++) {
        Draw-Pixel $g $pal.white (20 + $sp * 2) (10 + ($sp % 3) * 3)
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-JabFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 4; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $pen = New-Pen $pal.chi 2
      try { $g.DrawLine($pen, 10, 16, 22 + $idx * 2, 16) } finally { $pen.Dispose() }
      Draw-Pixel $g $pal.gold (23 + $idx * 2) 15 2 2
      Draw-Pixel $g $pal.white (25 + $idx * 2) 16 2 2
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-FivePointFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 6; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      for ($i = 0; $i -lt 5; $i++) {
        $angle = [Math]::PI * 2 / 5 * $i - [Math]::PI / 2
        $dx = [int]([Math]::Round([Math]::Cos($angle) * (5 + $idx)))
        $dy = [int]([Math]::Round([Math]::Sin($angle) * (5 + $idx)))
        Draw-Pixel $g $pal.strike (16+$dx) (16+$dy) 2 2
      }
      Draw-Pixel $g $pal.chi 15 15 2 2
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-DragonsFuryFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 7; $idx++) {
    $frame = New-Frame $largeGrid; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 8 + $idx
      Draw-Ring $g $pal.orange 20 20 $r 2
      for ($i = 0; $i -lt 4; $i++) {
        $angle = [Math]::PI * 2 / 4 * $i + $idx * 0.6
        $dx = [int]([Math]::Round([Math]::Cos($angle) * ($r + 2)))
        $dy = [int]([Math]::Round([Math]::Sin($angle) * ($r + 2)))
        Draw-Pixel $g $pal.chi (20+$dx) (20+$dy) 2 2
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

function Add-ParryFlashFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 5; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 3 + $idx * 2
      Draw-Ring $g $pal.white 16 16 $r 2
      Draw-Ring $g $pal.chi   16 16 ($r - 2) 1
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

$generated = @(
  @{ Name = 'serenity_aura';      Frames = (Add-SerenityAuraFrames);  Size = $largeFrame }
  @{ Name = 'flying_kick_impact'; Frames = (Add-FlyingKickFrames);    Size = $frameSize  }
  @{ Name = 'jab_impact';         Frames = (Add-JabFrames);           Size = $frameSize  }
  @{ Name = 'five_point_impact';  Frames = (Add-FivePointFrames);     Size = $frameSize  }
  @{ Name = 'dragons_fury_pulse'; Frames = (Add-DragonsFuryFrames);   Size = $largeFrame }
  @{ Name = 'parry_flash';        Frames = (Add-ParryFlashFrames);    Size = $frameSize  }
)
foreach ($e in $generated) {
  try { Save-Strip $e.Name $e.Frames $e.Size }
  finally { foreach ($f in $e.Frames) { $f.Dispose() } }
}
Write-Output "Wrote Monk VFX strips to $outDir"
