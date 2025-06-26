'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-8 text-center">
            <div className="max-w-md mx-auto">
              <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-6">
                <h2 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h2>
                <p className="text-zinc-400">
                  We encountered an error while loading this content. Please try refreshing the page.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-red-900/50 text-white rounded hover:bg-red-900/70 transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}