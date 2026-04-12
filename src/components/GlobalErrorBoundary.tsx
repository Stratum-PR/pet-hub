import React from 'react';
import { isIgnorableWindowErrorEvent } from '@/lib/ignorableWindowErrorEvent';
import { devConsole, isClientDebugSurfacesEnabled } from '@/lib/clientDebug';

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
      devConsole.warn('[GlobalErrorBoundary] Ignoring harmless AbortError:', error);
      return;
    }
    devConsole.error('[GlobalErrorBoundary] React render error:', error, errorInfo);
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
    if (isIgnorableWindowErrorEvent(event)) {
      return;
    }
    const err = event.error || event.message;
    // Ignore AbortErrors
    if (isAbortError(err)) {
      devConsole.warn('[GlobalErrorBoundary] Ignoring harmless AbortError:', err);
      return;
    }
    devConsole.error('[GlobalErrorBoundary] window.error:', err, event);
    this.setState({ lastEventError: err });
  };

  onUnhandledRejection = (event: PromiseRejectionEvent) => {
    // Ignore AbortErrors
    if (isAbortError(event.reason)) {
      devConsole.warn('[GlobalErrorBoundary] Ignoring harmless AbortError:', event.reason);
      return;
    }
    devConsole.error('[GlobalErrorBoundary] unhandledrejection:', event.reason, event);
    this.setState({ lastEventError: event.reason });
  };

  render() {
    const { error, errorInfo, lastEventError } = this.state;

    if (!error && !lastEventError) return this.props.children;

    const showDebugErrorUi = isClientDebugSurfacesEnabled();
    const message = showDebugErrorUi
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
          {showDebugErrorUi
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
          {showDebugErrorUi && errorInfo?.componentStack ? `\n\nComponent stack:\n${errorInfo.componentStack}` : ''}
        </pre>
      </div>
    );
  }
}

