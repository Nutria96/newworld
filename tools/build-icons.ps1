param([string]$Root = (Resolve-Path "$PSScriptRoot\.."))
Add-Type -AssemblyName System.Drawing
$master = Join-Path $Root "apps\web\assets\icon\nutria-astronauta-master.png"
$out = Join-Path $Root "apps\web\assets\icon"
$mobile = Join-Path $Root "apps\mobile\resources"
New-Item -ItemType Directory -Force -Path $out,$mobile | Out-Null

function Resize-Png([int]$size,[string]$target) {
  $source=[System.Drawing.Image]::FromFile($master)
  try {
    $bitmap=New-Object System.Drawing.Bitmap($size,$size)
    $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($source,0,0,$size,$size)
      $bitmap.Save($target,[System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
  } finally { $source.Dispose() }
}

$sizes=16,32,64,128,256,512,1024
foreach($size in $sizes){ Resize-Png $size (Join-Path $out "icon-$size.png") }
Copy-Item (Join-Path $out "icon-1024.png") (Join-Path $out "social-profile-1024.png") -Force
Copy-Item (Join-Path $out "icon-1024.png") (Join-Path $mobile "icon.png") -Force

# ICO con entradas PNG modernas y múltiples resoluciones.
$icoPath=Join-Path $out "nutria-astronauta.ico"
$pngs=@($sizes | ForEach-Object { [IO.File]::ReadAllBytes((Join-Path $out "icon-$_.png")) })
$stream=[IO.File]::Create($icoPath);$writer=New-Object IO.BinaryWriter($stream)
try {
  $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$sizes.Count)
  $offset=6+(16*$sizes.Count)
  for($i=0;$i-lt$sizes.Count;$i++){$s=$sizes[$i];$writer.Write([byte]($(if($s-ge 256){0}else{$s})));$writer.Write([byte]($(if($s-ge 256){0}else{$s})));$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$pngs[$i].Length);$writer.Write([uint32]$offset);$offset+=$pngs[$i].Length}
  foreach($bytes in $pngs){$writer.Write($bytes)}
} finally {$writer.Dispose();$stream.Dispose()}

function BE32([int]$value){[byte[]]$bytes=@((($value-shr 24)-band 255),(($value-shr 16)-band 255),(($value-shr 8)-band 255),($value-band 255));return ,$bytes}
$types=@{16="icp4";32="icp5";64="icp6";128="ic07";256="ic08";512="ic09";1024="ic10"}
$chunks=New-Object Collections.Generic.List[byte]
foreach($s in $sizes){$data=[IO.File]::ReadAllBytes((Join-Path $out "icon-$s.png"));$chunks.AddRange([Text.Encoding]::ASCII.GetBytes($types[$s]));$chunks.AddRange((BE32 ($data.Length+8)));$chunks.AddRange($data)}
$icns=[IO.File]::Create((Join-Path $out "nutria-astronauta.icns"));try{$magic=[Text.Encoding]::ASCII.GetBytes("icns");$length=BE32 ($chunks.Count+8);$payload=$chunks.ToArray();$icns.Write($magic,0,$magic.Length);$icns.Write($length,0,$length.Length);$icns.Write($payload,0,$payload.Length)}finally{$icns.Dispose()}

# Splash cuadrado para que @capacitor/assets derive variantes nativas.
$canvas=New-Object Drawing.Bitmap(2732,2732);$g=[Drawing.Graphics]::FromImage($canvas);$icon=[Drawing.Image]::FromFile($master)
try{$g.Clear([Drawing.Color]::FromArgb(7,11,24));$g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;$g.DrawImage($icon,666,666,1400,1400);$canvas.Save((Join-Path $mobile "splash.png"),[Drawing.Imaging.ImageFormat]::Png)}finally{$icon.Dispose();$g.Dispose();$canvas.Dispose()}
