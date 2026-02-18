import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  lastEventError: unknown;
};

function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.name === 'AbortError' || err.message.includes('aborted') || err.message.includes('AbortError');
  }
  if (typeof err === 'string') {
    return err.includes('AbortError') || err.includes('aborted');
  }
  return false;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, errorInfo: null, lastEventError: null };

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Ignore AbortErrors - these are harmless
    if (isAbortError(error)) {
      // eslint-disable-next-line no-console
      console.warn('[GlobalErrorBoundary] Ignoring harmless AbortError:', error);
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[GlobalErrorBoundary] React render error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  componentDidMount() {
    window.addEventListener('error', this.onWindowError);
    window.addEventListener('unhandledrejection', this.onUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.onWindowError);
    window.removeEventListener('unhandledrejection', this.onUnhandledRejection);
  }

  onWindowError = (event: ErrorEvent) => {
    const err = event.error || event.message;
    // Ignore AbortErrors
    if (isAbortError(err)) {
      // eslint-disable-next-line no-console
      console.warn('[GlobalErrorBoundary] Ignoring harmless AbortError:', err);
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[GlobalErrorBoundary] window.error:', err, event);
    this.setState({ lastEventError: err });
  };

  onUnhandledRejection = (event: PromiseRejectionEvent) => {
    // Ignore AbortErrors
    if (isAbortError(event.reason)) {
      // eslint-disable-next-line no-console
      console.warn('[GlobalErrorBoundary] Ignoring harmless AbortError:', event.reason);
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[GlobalErrorBoundary] unhandledrejection:', event.reason, event);
    this.setState({ lastEventError: event.reason });
  };

  render() {
    const { error, errorInfo, lastEventError } = this.state;

    if (!error && !lastEventError) return this.props.children;

    const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
    const message = isDev
      ? ((error && (error.stack || error.message)) ||
          (typeof lastEventError === 'string'
            ? lastEventError
            : JSON.stringify(lastEventError, null, 2)))
      : 'Something went wrong. Please refresh the page or try again later.';

    return (
      <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Something went wrong
        </h2>
        <p style={{ marginBottom: 12 }}>
          {isDev
            ? 'Open DevTools Console for full logs. Copy the error below and paste it here.'
            : 'Please refresh the page or try again later.'}
        </p>
        <pre
          style={{
            background: '#111827',
            color: '#e5e7eb',
            padding: 12,
            borderRadius: 8,
            overflow: 'auto',
            maxHeight: 360,
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {message}
          {isDev && errorInfo?.componentStack ? `\n\nComponent stack:\n${errorInfo.componentStack}` : ''}
        </pre>
      </div>
    );
  }
}

