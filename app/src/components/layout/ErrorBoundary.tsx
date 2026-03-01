import React, { Component, ErrorInfo, ReactNode } from 'react';
import { LoadErrorState } from '../ui/LoadErrorState';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <LoadErrorState
          title="Something went wrong"
          message={this.state.error?.message || 'An unexpected error occurred. Please try again.'}
          retryLabel="Refresh Page"
          backLabel="Go Home"
          onRetry={() => window.location.reload()}
          onBack={() => {
            window.location.href = '/'
          }}
        />
      );
    }

    return this.props.children;
  }
}
