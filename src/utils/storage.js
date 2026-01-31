/**
 * Storage Service - Local storage wrapper with JSON support
 */

export class StorageService {
    constructor(prefix = 'finai_') {
        this.prefix = prefix;
    }

    /**
     * Get item from localStorage
     */
    get(key) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            if (!item) return null;

            const parsed = JSON.parse(item);

            // Check expiry if exists
            if (parsed.expiry && Date.now() > parsed.expiry) {
                this.remove(key);
                return null;
            }

            return parsed.value !== undefined ? parsed.value : parsed;
        } catch (error) {
            console.error('Storage get error:', error);
            return null;
        }
    }

    /**
     * Set item in localStorage
     */
    set(key, value, expiryMs = null) {
        try {
            const item = expiryMs
                ? { value, expiry: Date.now() + expiryMs }
                : { value };

            localStorage.setItem(this.prefix + key, JSON.stringify(item));
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            return false;
        }
    }

    /**
     * Remove item from localStorage
     */
    remove(key) {
        try {
            localStorage.removeItem(this.prefix + key);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Clear all items with prefix
     */
    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if key exists
     */
    has(key) {
        return localStorage.getItem(this.prefix + key) !== null;
    }
}
