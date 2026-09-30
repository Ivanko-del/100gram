import { Component, ErrorInfo, ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Last line of defence: a render crash shows a readable screen with a
 * reload button instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">🥃</div>
          <h1>Щось пішло не так</h1>
          <p className="auth-subtitle">Застосунок натрапив на помилку. Спробуй перезавантажити.</p>
          <div className="auth-error">{this.state.error.message}</div>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Перезавантажити
          </button>
        </div>
      </div>
    );
  }
}
