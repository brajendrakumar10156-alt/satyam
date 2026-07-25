import React, { Suspense, lazy } from 'react';
import { isDesktopApp } from './utils/env';

// Lazy loading to ensure code splitting
const WebContainer = lazy(() => import('./WebContainer'));

export default function App({ onLogout, onBackToCoins }: { onLogout?: () => void, onBackToCoins?: () => void }) {
    return (
        <Suspense fallback={<div className="w-screen h-screen bg-[#0b0e14] flex items-center justify-center text-white font-mono text-sm tracking-widest">LOADING QUANTA TERMINAL...</div>}>
            <WebContainer onLogout={onLogout} onBackToCoins={onBackToCoins} />
        </Suspense>
    );
}
