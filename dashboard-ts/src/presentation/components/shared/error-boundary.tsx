import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/presentation/components/ui/button"
import { Activity, RefreshCw } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
          <Activity className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">Algo salió mal</h2>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            Ha ocurrido un error inesperado. Intente recargar la página.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Recargar
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
