using System;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Printing;

namespace WinGdiPrint {
    class Program {
        static void Binarize(Bitmap bmp, byte threshold = 210) {
            BitmapData data = bmp.LockBits(
                new Rectangle(0, 0, bmp.Width, bmp.Height),
                ImageLockMode.ReadWrite,
                PixelFormat.Format32bppArgb
            );

            unsafe {
                byte* ptr = (byte*)data.Scan0;
                int bytes = Math.Abs(data.Stride) * bmp.Height;
                for (int i = 0; i < bytes; i += 4) {
                    byte b = ptr[i];
                    byte g = ptr[i + 1];
                    byte r = ptr[i + 2];
                    int lum = (r * 77 + g * 150 + b * 29) >> 8;

                    if (lum < threshold) {
                        ptr[i] = 0;       // B
                        ptr[i + 1] = 0;   // G
                        ptr[i + 2] = 0;   // R
                        ptr[i + 3] = 255; // A
                    } else {
                        ptr[i] = 255;     // B
                        ptr[i + 1] = 255; // G
                        ptr[i + 2] = 255; // R
                        ptr[i + 3] = 255; // A
                    }
                }
            }

            bmp.UnlockBits(data);
        }

        static int Main(string[] args) {
            if (args.Length > 0 && (args[0] == "list-fonts" || args[0] == "--list-fonts")) {
                try {
                    foreach (FontFamily ff in FontFamily.Families) {
                        Console.WriteLine(ff.Name);
                    }
                    return 0;
                } catch (Exception ex) {
                    Console.Error.WriteLine(ex.Message);
                    return 1;
                }
            }

            if (args.Length < 2) {
                Console.Error.WriteLine("Uso: wingdiprint.exe <NombreImpresora> <RutaImagen> [TituloDoc] [PaperWidth:58mm|80mm]");
                return 1;
            }

            string printerName = args[0];
            string imagePath = args[1];
            string docTitle = args.Length > 2 ? args[2] : "POS Ticket";
            string paperWidthArg = args.Length > 3 ? args[3] : "58mm";
            bool is58mm = paperWidthArg.IndexOf("58", StringComparison.OrdinalIgnoreCase) >= 0;

            if (!File.Exists(imagePath)) {
                Console.Error.WriteLine("El archivo de imagen no existe: " + imagePath);
                return 2;
            }

            try {
                using (Bitmap bmp = new Bitmap(imagePath)) {
                    // Forzar binarizacion a blanco y negro puro (0% grises, 100% solido)
                    Binarize(bmp, 210);

                    PrintDocument pd = new PrintDocument();
                    pd.PrinterSettings.PrinterName = printerName;
                    pd.DocumentName = docTitle;
                    pd.PrintController = new StandardPrintController(); // Silencioso sin ventana de dialogo

                    pd.DefaultPageSettings.Margins = new Margins(0, 0, 0, 0);
                    pd.OriginAtMargins = false;

                    // Ancho objetivo util en centesimas de pulgada (189 para 48mm util / 283 para 72mm util)
                    int targetWidthHundredths = is58mm ? 189 : 283;
                    float ratio = (float)bmp.Height / (float)bmp.Width;
                    int targetHeightHundredths = (int)Math.Ceiling(targetWidthHundredths * ratio);

                    try {
                        pd.DefaultPageSettings.PaperSize = new PaperSize("POS Receipt", targetWidthHundredths, Math.Max(targetHeightHundredths, 100));
                    } catch {
                        // Driver con lista cerrada de tamanos de papel
                    }

                    pd.PrintPage += (sender, ev) => {
                        float dpiX = ev.Graphics.DpiX > 0 ? ev.Graphics.DpiX : 203f;
                        float dpiY = ev.Graphics.DpiY > 0 ? ev.Graphics.DpiY : 203f;

                        // Ajustar la resolucion de la imagen al DPI real de la impresora
                        bmp.SetResolution(dpiX, dpiY);

                        float maxAllowedWidth = is58mm ? 189f : 283f;
                        if (ev.PageBounds.Width > 0 && ev.PageBounds.Width < maxAllowedWidth) {
                            maxAllowedWidth = ev.PageBounds.Width;
                        }

                        float drawWidth = (bmp.Width / dpiX) * 100f;
                        float drawHeight = (bmp.Height / dpiY) * 100f;

                        if (drawWidth > maxAllowedWidth) {
                            float scale = maxAllowedWidth / drawWidth;
                            drawWidth = maxAllowedWidth;
                            drawHeight *= scale;
                        }

                        RectangleF destRect = new RectangleF(0, 0, drawWidth, drawHeight);

                        ev.Graphics.PageUnit = GraphicsUnit.Display;
                        ev.Graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
                        ev.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.None;
                        ev.Graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;
                        ev.Graphics.DrawImage(bmp, destRect);
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
