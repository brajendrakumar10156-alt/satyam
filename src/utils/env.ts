/**
 * Environment Detector
 * Determines if the current context is running inside a Tauri Desktop Application
 * or a standard Web Browser.
 */

// If window.__TAURI_INTERNALS__ or similar exists, it's the Native Desktop App
export const isDesktopApp = (): boolean => {
    return typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
};

// If not, it's the standard Web Browser (Chrome/Safari)
export const isWebApp = (): boolean => {
    return !isDesktopApp();
};
