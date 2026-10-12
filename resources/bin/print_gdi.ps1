param (
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,

    [Parameter(Mandatory=$true)]
    [string]$ImagePath,

    [Parameter(Mandatory=$false)]
    [string]$DocTitle = "POS Ticket"
)

if (-not (Test-Path $ImagePath)) {
    Write-Error "El archivo de imagen no existe: $ImagePath"
    exit 2
}

Add-Type -AssemblyName System.Drawing

try {
    $img = [System.Drawing.Image]::FromFile($ImagePath)
    $pd = New-Object System.Drawing.Printing.PrintDocument
    $pd.PrinterSettings.PrinterName = $PrinterName
    $pd.DocumentName = $DocTitle
    $pd.PrintController = New-Object System.Drawing.Printing.StandardPrintController
    $pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
    $pd.OriginAtMargins = $false

    $dpiX = if ($img.HorizontalResolution -gt 0) { $img.HorizontalResolution } else { 96 }
    $dpiY = if ($img.VerticalResolution -gt 0) { $img.VerticalResolution } else { 96 }
    $widthH = [Math]::Ceiling(($img.Width / $dpiX) * 100)
    $heightH = [Math]::Ceiling(($img.Height / $dpiY) * 100)

    try {
        $pd.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize("POS Receipt", $widthH, $heightH)
    } catch {}

    $printAction = {
        param($sender, $ev)
        $ev.Graphics.PageUnit = [System.Drawing.GraphicsUnit]::Pixel
        $ev.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $ev.Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
        $ev.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
        $ev.Graphics.DrawImage($img, 0, 0, $img.Width, $img.Height)
        $ev.HasMorePages = $false
    }

    $pd.add_PrintPage($printAction)
    $pd.Print()
    $img.Dispose()
    Write-Output "OK"
    exit 0
} catch {
    Write-Error "Error imprimiendo via GDI PowerShell: $_"
    exit 3
}
