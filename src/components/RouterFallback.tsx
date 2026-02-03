import React from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';

type Props = {
  children: React.ReactNode;
};

type State = {
  useHash: boolean;
  error: Error | null;
};

/**
 * Renders BrowserRouter first. If it throws (e.g. getUrlBasedHistory in restricted
 * iframe or environment), falls back to HashRouter so the app can start.
 */
export class RouterFallback extends React.Component<Props, State> {
  state: State = { useHash: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Fall back to HashRouter on any error (e.g. getUrlBasedHistory in restricted iframe)
    return { useHash: true, error };
  }

  componentDidCatch(error: Error) {
    this.setState({ useHash: true });
  }

  render() {
    if (this.state.useHash) {
      return <HashRouter>{this.props.children}</HashRouter>;
    }
    return <BrowserRouter>{this.props.children}</BrowserRouter>;
  }
}
