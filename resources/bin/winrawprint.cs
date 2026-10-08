using System;
using System.IO;
using System.Runtime.InteropServices;

namespace WinRawPrint {
    class Program {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public class DOCINFO {
            public string pDocName;
            public string pOutputFile;
            public string pDataType;
        }

        [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFO di);

        [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

        static int Main(string[] args) {
            if (args.Length < 2) {
                Console.Error.WriteLine("Uso: winrawprint.exe <NombreImpresora> <RutaArchivoBytes> [TituloDocumento]");
                return 1;
            }

            string printerName = args[0];
            string filePath = args[1];
            string docTitle = args.Length > 2 ? args[2] : "POS Receipt";

            if (!File.Exists(filePath)) {
                Console.Error.WriteLine("El archivo no existe: " + filePath);
                return 2;
            }

            byte[] bytes = File.ReadAllBytes(filePath);
            if (bytes.Length == 0) {
                Console.WriteLine("Archivo vacio.");
                return 0;
            }

            IntPtr hPrinter;
            DOCINFO di = new DOCINFO();
            di.pDocName = docTitle;
            di.pDataType = "RAW";

            if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
                int err = Marshal.GetLastWin32Error();
                Console.Error.WriteLine("No se pudo abrir la impresora '" + printerName + "'. Error Win32: " + err);
                return 3;
            }

            try {
                if (!StartDocPrinter(hPrinter, 1, di)) {
                    int err = Marshal.GetLastWin32Error();
                    Console.Error.WriteLine("StartDocPrinter fallo. Error Win32: " + err);
                    return 4;
                }

                try {
                    if (!StartPagePrinter(hPrinter)) {
                        int err = Marshal.GetLastWin32Error();
                        Console.Error.WriteLine("StartPagePrinter fallo. Error Win32: " + err);
                        return 5;
                    }

                    try {
                        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                        try {
                            Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                            int dwWritten;
                            if (!WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten)) {
                                int err = Marshal.GetLastWin32Error();
                                Console.Error.WriteLine("WritePrinter fallo. Error Win32: " + err);
                                return 6;
                            }
                        } finally {
                            Marshal.FreeCoTaskMem(pUnmanagedBytes);
                        }
                    } finally {
                        EndPagePrinter(hPrinter);
                    }
                } finally {
                    EndDocPrinter(hPrinter);
                }
            } finally {
                ClosePrinter(hPrinter);
            }

            Console.WriteLine("OK");
            return 0;
        }
    }
}
