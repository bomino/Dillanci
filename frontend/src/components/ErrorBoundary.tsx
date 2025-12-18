import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-neutral-600 mb-4">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-4 p-4 bg-neutral-100 rounded-lg text-left overflow-auto">
                <p className="text-sm font-mono text-red-600 mb-2">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-xs text-neutral-600 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50"
              >
                Try Again
              </button>
              <button
                onClick={this.handleRefresh}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
