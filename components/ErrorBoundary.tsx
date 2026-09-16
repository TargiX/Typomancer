import React from 'react';
import { captureError } from '../services/errorReporting';

interface ErrorBoundaryProps {
    children?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

/**
 * A render crash used to mean a blank screen mid-run. Progress lives in
 * localStorage, so the honest recovery is a reload — the profile survives it.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    // No @types/react in this project — React is `any`, so the base-class member
    // must be declared locally for `this.props` to typecheck.
    declare props: ErrorBoundaryProps;
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: unknown) {
        console.error('App crash', error);
        captureError(error);
    }

    render() {
        if (!this.state.hasError) return this.props.children;
        return (
            <div className="min-h-screen bg-[#070a11] text-slate-200 font-mono flex items-center justify-center p-6">
                <div className="text-center space-y-5 max-w-sm">
                    <div className="fs-micro uppercase tracking-[0.3em] text-rose-400/80">ERR // LINK_SEVERED</div>
                    <h1 className="font-display text-3xl font-bold text-white tracking-tight">SIGNAL LOST</h1>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        The interface crashed. Your operator record and progress are stored locally and survive a reload.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="btn-cyber btn-cyber-primary px-8 py-3 font-display font-bold tracking-[0.06em] text-[#04120b]"
                    >
                        RELOAD
                    </button>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
