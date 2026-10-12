using System;
using System.IO;
using System.Drawing;
using System.Drawing.Printing;

namespace WinGdiPrint {
    class Program {
        static int Main(string[] args) {
            if (args.Length < 2) {
                Console.Error.WriteLine("Uso: wingdiprint.exe <NombreImpresora> <RutaImagen> [TituloDoc]");
                return 1;
            }

            string printerName = args[0];
            string imagePath = args[1];
            string docTitle = args.Length > 2 ? args[2] : "POS Ticket";

            if (!File.Exists(imagePath)) {
                Console.Error.WriteLine("El archivo de imagen no existe: " + imagePath);
                return 2;
            }

            try {
                using (Image img = Image.FromFile(imagePath)) {
                    PrintDocument pd = new PrintDocument();
                    pd.PrinterSettings.PrinterName = printerName;
                    pd.DocumentName = docTitle;
                    pd.PrintController = new StandardPrintController(); // Silencioso sin ventana de diálogo

                    pd.DefaultPageSettings.Margins = new Margins(0, 0, 0, 0);
                    pd.OriginAtMargins = false;

                    float dpiX = img.HorizontalResolution > 0 ? img.HorizontalResolution : 96f;
                    float dpiY = img.VerticalResolution > 0 ? img.VerticalResolution : 96f;

                    int widthHundredths = (int)Math.Ceiling((img.Width / (double)dpiX) * 100.0);
                    int heightHundredths = (int)Math.Ceiling((img.Height / (double)dpiY) * 100.0);

                    if (widthHundredths <= 0) widthHundredths = 228;
                    if (heightHundredths <= 0) heightHundredths = 500;

                    try {
                        pd.DefaultPageSettings.PaperSize = new PaperSize("POS Receipt", widthHundredths, heightHundredths);
                    } catch {
                        // Driver con lista cerrada de tamaños de papel, usar el predeterminado del driver
                    }

                    pd.PrintPage += (sender, ev) => {
                        ev.Graphics.PageUnit = GraphicsUnit.Pixel;
                        ev.Graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                        ev.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.None;
                        ev.Graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;
                        ev.Graphics.DrawImage(img, 0, 0, img.Width, img.Height);
                        ev.HasMorePages = false;
                    };

                    pd.Print();
                }

                Console.WriteLine("OK");
                return 0;
            } catch (Exception ex) {
                Console.Error.WriteLine("Error al imprimir via GDI: " + ex.Message);
                return 3;
            }
        }
    }
}
