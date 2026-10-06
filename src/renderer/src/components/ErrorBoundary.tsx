import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary capturó un error:', error, errorInfo)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-6 select-none">
          <div className="bg-white rounded-3xl shadow-2xl border border-rose-200 max-w-lg w-full p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-rose-100 shadow-sm">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-black text-slate-900 mb-1">
              Ha ocurrido un error inesperado
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              La aplicación encontró un problema al renderizar este componente. Tus datos no se han perdido.
            </p>

            {this.state.error && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs font-mono text-slate-700 mb-5 max-h-36 overflow-auto">
                <span className="font-bold text-rose-600 block mb-1">Detalle del error:</span>
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-md shadow-lilac-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recargar Aplicación</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
