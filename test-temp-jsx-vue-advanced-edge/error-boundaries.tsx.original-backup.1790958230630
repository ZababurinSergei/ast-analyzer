
        import React from 'react';
        
        interface ErrorBoundaryProps {
          children: React.ReactNode;
          fallback?: React.ReactNode;
          onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
        }
        
        interface ErrorBoundaryState {
          hasError: boolean;
          error: Error | null;
        }
        
        class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
          constructor(props: ErrorBoundaryProps) {
            super(props);
            this.state = { hasError: false, error: null };
          }
          
          static getDerivedStateFromError(error: Error): ErrorBoundaryState {
            return { hasError: true, error };
          }
          
          componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
            this.props.onError?.(error, errorInfo);
            console.error('Error caught:', error, errorInfo);
          }
          
          render() {
            if (this.state.hasError) {
              if (this.props.fallback) {
                return this.props.fallback;
              }
              return (
                <div className="error-boundary">
                  <h2>Something went wrong</h2>
                  <details>
                    <summary>Error details</summary>
                    <pre>{this.state.error?.message}</pre>
                  </details>
                </div>
              );
            }
            
            return this.props.children;
          }
        }
        
        function BuggyComponent() {
          const [shouldThrow, setShouldThrow] = useState(false);
          
          if (shouldThrow) {
            throw new Error('Intentional error!');
          }
          
          return (
            <div>
              <button onClick={() => setShouldThrow(true)}>
                Throw Error
              </button>
            </div>
          );
        }
        
        function App() {
          const [errorCount, setErrorCount] = useState(0);
          
          return (
            <ErrorBoundary
              fallback={<div>Custom fallback UI</div>}
              onError={() => setErrorCount(prev => prev + 1)}
            >
              <BuggyComponent />
            </ErrorBoundary>
          );
        }
        
        export { App, ErrorBoundary, BuggyComponent };
      