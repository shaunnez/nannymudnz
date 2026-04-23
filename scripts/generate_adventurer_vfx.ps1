Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $repoRoot 'public\vfx\adventurer'
$frameSize = 96; $gridSize = 32
$largeFrame = 160; $largeGrid = 40

if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

function New-Color([string]$hex,[int]$alpha=255) {
  $hex=$hex.TrimStart('#')
  return [System.Drawing.Color]::FromArgb($alpha,
    [Convert]::ToInt32($hex.Substring(0,2),16),
    [Convert]::ToInt32($hex.Substring(2,2),16),
    [Convert]::ToInt32($hex.Substring(4,2),16))
}
$pal = @{
  gold=[New-Color '#c9a961']; lgold=[New-Color '#fde68a']; amber=[New-Color '#f59e0b']
  orange=[New-Color '#f97316']; green=[New-Color '#22c55e']; lgreen=[New-Color '#86efac']
  white=[New-Color '#f8fafc']; dark=[New-Color '#1c1917']
}
function New-Brush($c){return New-Object System.Drawing.SolidBrush($c)}
function New-Pen($c,[float]$w=1){$p=New-Object System.Drawing.Pen($c,$w);$p.LineJoin=[System.Drawing.Drawing2D.LineJoin]::Round;return $p}
function New-Frame([int]$size=$gridSize){return New-Object System.Drawing.Bitmap($size,$size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)}
function Scale-Frame([System.Drawing.Bitmap]$f,[int]$target=$frameSize){
  $s=New-Object System.Drawing.Bitmap($target,$target,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g=[System.Drawing.Graphics]::FromImage($s)
  try{$g.CompositingMode=[System.Drawing.Drawing2D.CompositingMode]::SourceCopy;$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor;$g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::Half;$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::None;$g.DrawImage($f,0,0,$target,$target)}finally{$g.Dispose()}
  return $s
}
function Save-Strip([string]$name,$frames,[int]$target=$frameSize){
  $strip=New-Object System.Drawing.Bitmap(($target*$frames.Count),$target,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g=[System.Drawing.Graphics]::FromImage($strip)
  try{
    $g.CompositingMode=[System.Drawing.Drawing2D.CompositingMode]::SourceCopy;$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor;$g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::Half;$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::None
    for($i=0;$i-lt$frames.Count;$i++){$sc=Scale-Frame $frames[$i] $target;try{$g.DrawImage($sc,$i*$target,0,$target,$target)}finally{$sc.Dispose()}}
  }finally{$g.Dispose()}
  $path=Join-Path $outDir "$name.png"
  try{$strip.Save($path,[System.Drawing.Imaging.ImageFormat]::Png)}finally{$strip.Dispose()}
}
function Draw-Pixel($g,$c,[int]$x,[int]$y,[int]$w=1,[int]$h=1){$b=New-Brush $c;try{$g.FillRectangle($b,$x,$y,$w,$h)}finally{$b.Dispose()}}
function Draw-Ring($g,$c,[int]$cx,[int]$cy,[int]$r,[int]$t=1){
  for($o=0;$o-lt$t;$o++){$p=New-Pen $c 1;try{$g.DrawEllipse($p,$cx-($r-$o),$cy-($r-$o),($r-$o)*2,($r-$o)*2)}finally{$p.Dispose()}}
}

function Add-RallyingCryFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 8;$idx++){
    $frame=New-Frame $largeGrid; $g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      $r=6+$idx*2; Draw-Ring $g $pal.amber 20 20 $r 2; Draw-Ring $g $pal.lgold 20 20 ($r-2) 1
      for($i=0;$i-lt 3;$i++){
        $angle=[Math]::PI*2/3*$i+$idx*0.5
        $dx=[int]([Math]::Round([Math]::Cos($angle)*($r+2))); $dy=[int]([Math]::Round([Math]::Sin($angle)*($r+2)))
        Draw-Pixel $g $pal.gold (20+$dx) (20+$dy) 2 2
      }
      Draw-Pixel $g $pal.white 19 17 2 2; $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}

function Add-SlashImpactFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 5;$idx++){
    $frame=New-Frame; $g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      for($sl=0;$sl-lt 3;$sl++){
        $sx=6+$sl*3+$idx*2; $sy=20-$sl*4
        $pen=New-Pen $pal.gold 2; $lite=New-Pen $pal.lgold 1
        try{$g.DrawLine($pen,$sx,$sy,$sx+12,$sy-12);$g.DrawLine($lite,$sx+1,$sy,$sx+11,$sy-11)}finally{$pen.Dispose();$lite.Dispose()}
      }
      for($sp=0;$sp-le$idx;$sp++){Draw-Pixel $g $pal.amber (20+$sp*2) (10+($sp%3)*3)}
      $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}

function Add-BandageGlowFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 6;$idx++){
    $frame=New-Frame; $g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      $r=4+$idx*2; Draw-Ring $g $pal.green 16 16 $r 2; Draw-Ring $g $pal.lgreen 16 16 ($r-2) 1
      Draw-Pixel $g $pal.white 15 10 2 12; Draw-Pixel $g $pal.white 10 15 12 2
      for($dot=0;$dot-lt($idx+1);$dot++){Draw-Pixel $g $pal.lgreen (8+$dot*3) (6+($dot%2)*3)}
      $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}

function Add-AdrenalineRushFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 7;$idx++){
    $frame=New-Frame $largeGrid; $g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      $r=5+$idx*2; Draw-Ring $g $pal.orange 20 20 $r 2; Draw-Ring $g $pal.amber 20 20 ($r-2) 1
      for($i=0;$i-lt 4;$i++){
        $angle=[Math]::PI*2/4*$i+$idx*0.4
        $dx=[int]([Math]::Round([Math]::Cos($angle)*($r+1))); $dy=[int]([Math]::Round([Math]::Sin($angle)*($r+1)))
        Draw-Pixel $g $pal.lgold (20+$dx) (20+$dy) 2 2
      }
      $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}

function Add-SecondWindFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 5;$idx++){
    $frame=New-Frame; $g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      $r=3+$idx*2; Draw-Ring $g $pal.amber 16 16 $r 2
      for($i=0;$i-lt 6;$i++){
        $angle=[Math]::PI*2/6*$i
        $dx=[int]([Math]::Round([Math]::Cos($angle)*($r+2))); $dy=[int]([Math]::Round([Math]::Sin($angle)*($r+2)))
        Draw-Pixel $g $pal.lgold (16+$dx) (16+$dy)
      }
      $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}

$generated=@(
  @{Name='rallying_cry_aura';Frames=(Add-RallyingCryFrames);Size=$largeFrame}
  @{Name='slash_impact';Frames=(Add-SlashImpactFrames);Size=$frameSize}
  @{Name='bandage_glow';Frames=(Add-BandageGlowFrames);Size=$frameSize}
  @{Name='adrenaline_rush_aura';Frames=(Add-AdrenalineRushFrames);Size=$largeFrame}
  @{Name='second_wind_glow';Frames=(Add-SecondWindFrames);Size=$frameSize}
)
foreach($e in $generated){try{Save-Strip $e.Name $e.Frames $e.Size}finally{foreach($f in $e.Frames){$f.Dispose()}}}
Write-Output "Wrote Adventurer VFX strips to $outDir"
