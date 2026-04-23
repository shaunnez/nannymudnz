Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $repoRoot 'public\vfx\cultist'
$frameSize = 96; $gridSize = 32
$largeFrame = 160; $largeGrid = 40

if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

function New-Color([string]$hex, [int]$alpha = 255) {
  $hex = $hex.TrimStart('#')
  return [System.Drawing.Color]::FromArgb($alpha,
    [Convert]::ToInt32($hex.Substring(0,2),16),
    [Convert]::ToInt32($hex.Substring(2,2),16),
    [Convert]::ToInt32($hex.Substring(4,2),16))
}
$pal = @{
  teal   = (New-Color '#2e4c3a')
  dark   = (New-Color '#134e4a')
  forest = (New-Color '#065f46')
  bright = (New-Color '#4ade80')
  void   = (New-Color '#000000')
  pale   = (New-Color '#d1fae5')
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
function Draw-Ring($g,$c,[int]$cx,[int]$cy,[int]$r,[int]$t=1){for($o=0;$o-lt$t;$o++){$p=New-Pen $c 1;try{$g.DrawEllipse($p,$cx-($r-$o),$cy-($r-$o),($r-$o)*2,($r-$o)*2)}finally{$p.Dispose()}}}

function Add-SummonBurstFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 8;$idx++){
    $frame=New-Frame $largeGrid;$g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      $r=4+$idx*2;Draw-Ring $g $pal.dark $largeGrid/2 $largeGrid/2 $r 2;Draw-Ring $g $pal.void $largeGrid/2 $largeGrid/2 ($r+2) 1
      for($i=0;$i-lt 6;$i++){$angle=[Math]::PI*2/6*$i+$idx*0.4;$dx=[int]([Math]::Round([Math]::Cos($angle)*($r+3)));$dy=[int]([Math]::Round([Math]::Sin($angle)*($r+3)));Draw-Pixel $g $pal.bright (20+$dx) (20+$dy) 2 2}
      $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}
function Add-MadnessBurstFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 7;$idx++){
    $frame=New-Frame $largeGrid;$g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      $r=3+$idx*2;Draw-Ring $g $pal.teal 20 20 $r 2;Draw-Ring $g $pal.forest 20 20 ($r-2) 1
      for($i=0;$i-lt 5;$i++){$angle=[Math]::PI*2/5*$i+$idx*0.5;$dx=[int]([Math]::Round([Math]::Cos($angle)*($r+2)));$dy=[int]([Math]::Round([Math]::Sin($angle)*($r+2)));Draw-Pixel $g $pal.pale (20+$dx) (20+$dy)}
      $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}
function Add-TendrilBurstFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 6;$idx++){
    $frame=New-Frame;$g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      Draw-Ring $g $pal.dark 16 16 (3+$idx*2) 2
      for($i=0;$i-lt 4;$i++){$px=8+($i%2)*16;$py=8+($i/2)*16;Draw-Pixel $g $pal.forest ([int]$px) ([int]$py) 2 ($idx+1)}
      Draw-Pixel $g $pal.bright 15 15 2 2
      $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}
function Add-GatePulseFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 8;$idx++){
    $frame=New-Frame $largeGrid;$g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      $r=5+$idx*2;Draw-Ring $g $pal.void 20 20 ($r+3) 1;Draw-Ring $g $pal.dark 20 20 $r 2
      for($i=0;$i-lt 4;$i++){$angle=[Math]::PI*2/4*$i-$idx*0.5;$dx=[int]([Math]::Round([Math]::Cos($angle)*($r+1)));$dy=[int]([Math]::Round([Math]::Sin($angle)*($r+1)));Draw-Pixel $g $pal.bright (20+$dx) (20+$dy) 2 2}
      $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}
function Add-GazeAuraFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 7;$idx++){
    $frame=New-Frame $largeGrid;$g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      $r=5+$idx*2;Draw-Ring $g $pal.teal 20 20 $r 2;Draw-Ring $g $pal.forest 20 20 ($r-2) 1
      for($i=0;$i-lt 3;$i++){$angle=[Math]::PI*2/3*$i+$idx*0.4;$dx=[int]([Math]::Round([Math]::Cos($angle)*($r+1)));$dy=[int]([Math]::Round([Math]::Sin($angle)*($r+1)));Draw-Pixel $g $pal.bright (20+$dx) (20+$dy) 2 2}
      $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}

$generated=@(
  @{Name='summon_burst';  Frames=(Add-SummonBurstFrames);  Size=$largeFrame}
  @{Name='madness_burst'; Frames=(Add-MadnessBurstFrames); Size=$largeFrame}
  @{Name='tendril_burst'; Frames=(Add-TendrilBurstFrames); Size=$frameSize}
  @{Name='gate_pulse';    Frames=(Add-GatePulseFrames);    Size=$largeFrame}
  @{Name='gaze_aura';     Frames=(Add-GazeAuraFrames);     Size=$largeFrame}
)
foreach($e in $generated){try{Save-Strip $e.Name $e.Frames $e.Size}finally{foreach($f in $e.Frames){$f.Dispose()}}}
Write-Output "Wrote Cultist VFX strips to $outDir"
