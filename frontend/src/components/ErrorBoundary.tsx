import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render-time crashes anywhere below it so a bug in one screen
 * shows a recoverable message instead of a blank white page. Does not
 * catch errors in event handlers or async code - those already go through
 * each call site's own try/catch (see describeSendError, DataError, ...). */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="auth-screen">
          <div className="auth-card">
            <div className="auth-logo">⚠️</div>
            <h1>Щось пішло не так</h1>
            <p className="auth-subtitle">Сталася непередбачена помилка. Спробуй перезавантажити сторінку.</p>
            <button className="btn-primary" type="button" onClick={() => window.location.reload()}>
              Перезавантажити
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
