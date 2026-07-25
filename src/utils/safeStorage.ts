/**
 * safeStorage.ts
 * 
 * Safely handles saving large arrays (like tick data) to localStorage.
 * Automatically slices arrays to stay within the 5MB browser quota.
 */

const MAX_CANDLES_IN_WEB = 1000;

export function safeStorageSetItem(key: string, dataArray: any[]) {
    try {
        // Enforce the 1,000 candle memory cap for Web Context (stays ~500KB)
        let dataToSave = dataArray;
        
        if (Array.isArray(dataArray) && dataArray.length > MAX_CANDLES_IN_WEB) {
            console.warn(`[SafeStorage] Capping data for ${key} from ${dataArray.length} to ${MAX_CANDLES_IN_WEB} to prevent QuotaExceededError.`);
            // Keep the most recent 1000 items
            dataToSave = dataArray.slice(-MAX_CANDLES_IN_WEB);
        }

        const jsonString = JSON.stringify(dataToSave);
        localStorage.setItem(key, jsonString);
        
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.error(`[SafeStorage] LocalStorage quota exceeded when saving ${key}.`);
            // Emergency fallback: clear old keys or reduce size further
            localStorage.clear();
            try {
                // Try to save just 100 items as emergency
                if (Array.isArray(dataArray)) {
                    localStorage.setItem(key, JSON.stringify(dataArray.slice(-100)));
                }
            } catch (fallbackError) {
                console.error('[SafeStorage] Emergency fallback failed.');
            }
        } else {
            console.error(`[SafeStorage] Error saving to localStorage: ${e.message}`);
        }
    }
}

export function safeStorageGetItem<T>(key: string): T | null {
    try {
        const data = localStorage.getItem(key);
        if (!data) return null;
        return JSON.parse(data) as T;
    } catch (e) {
        console.error(`[SafeStorage] Error reading from localStorage:`, e);
        return null;
    }
}
