param (
    [Parameter(Mandatory=$false)]
    [switch]$ListFonts,

    [Parameter(Mandatory=$false)]
    [string]$PrinterName,

    [Parameter(Mandatory=$false)]
    [string]$ImagePath,

    [Parameter(Mandatory=$false)]
    [string]$DocTitle = "POS Ticket",

    [Parameter(Mandatory=$false)]
    [string]$PaperWidth = "58mm"
)

if ($ListFonts) {
    Add-Type -AssemblyName System.Drawing
    [System.Drawing.FontFamily]::Families | ForEach-Object { $_.Name }
    exit 0
}

if ([string]::IsNullOrWhiteSpace($PrinterName) -or [string]::IsNullOrWhiteSpace($ImagePath)) {
    Write-Error "Faltan parametros requeridos: PrinterName e ImagePath."
    exit 1
}

if (-not (Test-Path $ImagePath)) {
    Write-Error "El archivo de imagen no existe: $ImagePath"
    exit 2
}

Add-Type -AssemblyName System.Drawing

$is58mm = $PaperWidth -match "58"

try {
    $bmp = New-Object System.Drawing.Bitmap($ImagePath)
    $pd = New-Object System.Drawing.Printing.PrintDocument
    $pd.PrinterSettings.PrinterName = $PrinterName
    $pd.DocumentName = $DocTitle
    $pd.PrintController = New-Object System.Drawing.Printing.StandardPrintController
    $pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
    $pd.OriginAtMargins = $false

    $targetWidthH = if ($is58mm) { 189 } else { 283 }
    $ratio = [float]$bmp.Height / [float]$bmp.Width
    $targetHeightH = [Math]::Max([Math]::Ceiling($targetWidthH * $ratio), 100)

    try {
        $pd.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize("POS Receipt", $targetWidthH, $targetHeightH)
    } catch {}

    $printAction = {
        param($sender, $ev)
        $dpiX = if ($ev.Graphics.DpiX -gt 0) { $ev.Graphics.DpiX } else { 203.0 }
        $dpiY = if ($ev.Graphics.DpiY -gt 0) { $ev.Graphics.DpiY } else { 203.0 }

        $bmp.SetResolution($dpiX, $dpiY)

        $maxWidth = if ($is58mm) { 189.0 } else { 283.0 }
        if ($ev.PageBounds.Width -gt 0 -and $ev.PageBounds.Width -lt $maxWidth) {
            $maxWidth = [double]$ev.PageBounds.Width
        }

        $drawW = ($bmp.Width / $dpiX) * 100.0
        $drawH = ($bmp.Height / $dpiY) * 100.0

        if ($drawW -gt $maxWidth) {
            $scale = $maxWidth / $drawW
            $drawW = $maxWidth
            $drawH = $drawH * $scale
        }

        $destRect = New-Object System.Drawing.RectangleF(0, 0, $drawW, $drawH)

        $ev.Graphics.PageUnit = [System.Drawing.GraphicsUnit]::Display
        $ev.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $ev.Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
        $ev.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
        $ev.Graphics.DrawImage($bmp, $destRect)
        $ev.HasMorePages = $false
    }

    $pd.add_PrintPage($printAction)
    $pd.Print()
    $bmp.Dispose()
    Write-Output "OK"
    exit 0
} catch {
    Write-Error "Error imprimiendo via GDI PowerShell: $_"
    exit 3
}
