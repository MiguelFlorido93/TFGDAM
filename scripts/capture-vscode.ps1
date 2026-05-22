# Captura una región rectangular de la pantalla y la guarda como PNG.
# Uso: powershell -File capture-vscode.ps1 -OutPath ".\docs\screenshots\foo.png" -X 273 -Y 30 -W 900 -H 220
param(
    [Parameter(Mandatory=$true)][string]$OutPath,
    [int]$X = 0,
    [int]$Y = 0,
    [int]$W = 0,
    [int]$H = 0
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

if ($W -eq 0 -or $H -eq 0) {
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $X = $bounds.X; $Y = $bounds.Y; $W = $bounds.Width; $H = $bounds.Height
}

$bitmap = New-Object System.Drawing.Bitmap $W, $H
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($X, $Y, 0, 0, (New-Object System.Drawing.Size $W, $H))

$dir = Split-Path -Parent $OutPath
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

$bitmap.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
Write-Output "Saved: $OutPath ($W x $H @ $X,$Y)"
