Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $repoRoot 'public\vfx\chef'
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
  pink   = (New-Color '#f48fb1')
  lpink  = (New-Color '#f9a8d4')
  gold   = (New-Color '#fde68a')
  amber  = (New-Color '#fbbf24')
  white  = (New-Color '#fff0f3')
  green  = (New-Color '#86efac')
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

function Add-FeastBurstFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 7;$idx++){
    $frame=New-Frame $largeGrid;$g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      $r=4+$idx*2;Draw-Ring $g $pal.pink 20 20 $r 2;Draw-Ring $g $pal.gold 20 20 ($r-2) 1
      for($i=0;$i-lt 4;$i++){$angle=[Math]::PI/2*$i+$idx*0.4;$dx=[int]([Math]::Round([Math]::Cos($angle)*($r+2)));$dy=[int]([Math]::Round([Math]::Sin($angle)*($r+2)));Draw-Pixel $g $pal.lpink (20+$dx) (20+$dy) 2 2}
      $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}
function Add-LadleImpactFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 4;$idx++){
    $frame=New-Frame;$g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      $pen=New-Pen $pal.pink 2;$lite=New-Pen $pal.gold 1
      try{$g.DrawLine($pen,8,20-$idx,20+$idx*2,8);$g.DrawLine($lite,10,20-$idx,22+$idx*2,8)}finally{$pen.Dispose();$lite.Dispose()}
      Draw-Pixel $g $pal.amber (20+$idx*2) 8 2 2
      $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}
function Add-HotSoupGlowFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 6;$idx++){
    $frame=New-Frame;$g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      $r=4+$idx*2;Draw-Ring $g $pal.gold 16 16 $r 2;Draw-Ring $g $pal.green 16 16 ($r-2) 1
      for($i=0;$i-lt($idx+1);$i++){Draw-Pixel $g $pal.white (8+$i*3) (6+($i%2)*3)}
      $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}
function Add-SignatureDishFrames {
  $frames=New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for($idx=0;$idx-lt 8;$idx++){
    $frame=New-Frame $largeGrid;$g=[System.Drawing.Graphics]::FromImage($frame)
    try{
      $r=5+$idx*2;Draw-Ring $g $pal.pink 20 20 $r 2;Draw-Ring $g $pal.amber 20 20 ($r+3) 1
      for($i=0;$i-lt 5;$i++){$angle=[Math]::PI*2/5*$i+$idx*0.4;$dx=[int]([Math]::Round([Math]::Cos($angle)*($r+1)));$dy=[int]([Math]::Round([Math]::Sin($angle)*($r+1)));Draw-Pixel $g $pal.gold (20+$dx) (20+$dy) 2 2}
      $frames.Add($frame)
    }finally{$g.Dispose()}
  }
  return $frames
}

$generated=@(
  @{Name='feast_burst';          Frames=(Add-FeastBurstFrames);       Size=$largeFrame}
  @{Name='ladle_impact';         Frames=(Add-LadleImpactFrames);      Size=$frameSize}
  @{Name='hot_soup_glow';        Frames=(Add-HotSoupGlowFrames);      Size=$frameSize}
  @{Name='signature_dish_pulse'; Frames=(Add-SignatureDishFrames);    Size=$largeFrame}
)
foreach($e in $generated){try{Save-Strip $e.Name $e.Frames $e.Size}finally{foreach($f in $e.Frames){$f.Dispose()}}}
Write-Output "Wrote Chef VFX strips to $outDir"
