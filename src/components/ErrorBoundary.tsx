"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches rendering errors and shows a friendly fallback UI.
 * Prevents the entire app from crashing when a component throws.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    // In production: send to error tracking service (Sentry, etc.)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-md">
            An unexpected error occurred. Please try again or refresh the page.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleRetry}
              className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black font-bold text-sm rounded-xl hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-sm rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Refresh Page
            </button>
          </div>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="mt-6 p-4 text-left text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg max-w-lg overflow-auto max-h-40">
              {this.state.error.message}
              {"\n"}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
