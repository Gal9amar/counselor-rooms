import React from 'react';
import { useLocation } from 'react-router-dom';
import ErrorPage from './ErrorPage';

class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Render error:', error?.message || error);
  }

  componentDidUpdate(prevProps) {
    // Leaving the broken route clears the error
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ErrorPage
        code={500}
        runtime
        showLogos
        title="משהו השתבש"
        message="אירעה תקלה בהצגת העמוד. טענו אותו מחדש, ואם זה חוזר, פנו למנהל המערכת."
        primaryAction={{ label: 'טעינה מחדש', onClick: () => window.location.reload() }}
        secondaryAction={{ label: 'חזרה לעמוד הראשי', to: '/' }}
        details={import.meta.env.DEV ? String(this.state.error?.message || this.state.error) : undefined}
      />
    );
  }
}

/** Must be rendered inside a Router: resets itself when the location changes. */
export default function ErrorBoundary({ children }) {
  const location = useLocation();
  return <Boundary resetKey={location.key}>{children}</Boundary>;
}
