import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('[TruthLens] ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="glass-card p-4 m-4 text-center">
            <p className="text-sm text-red-400 mb-2">Something went wrong</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="btn-secondary text-xs"
            >
              Try Again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
