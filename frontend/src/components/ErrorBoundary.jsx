import { Component } from 'react';

/** Last line of defence: a render crash (e.g. inside the whiteboard) shows a way out, not a blank page. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ui] Unhandled render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="lobby-state workspace-denied">
        <h2>Something went wrong</h2>
        <p>The page hit an unexpected error. Your board is saved — reloading usually fixes this.</p>
        <div className="modal-actions">
          <button onClick={() => window.location.assign('/lobby')}>Back to your boards</button>
          <button className="primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
