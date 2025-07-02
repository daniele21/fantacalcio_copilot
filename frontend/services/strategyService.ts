import { Role, TargetPlayer } from '../types';
import { AuthContextType } from './AuthContext';
import { useApi } from './useApi';

const BASE_URL = 'http://127.0.0.1:5000';

export interface UserStrategy {
    targetPlayerIds: { id: number; maxBid: number }[];
    roleBudget: Record<Role, number>;
}

/**
 * Saves the user's strategy to the backend.
 * @param roleBudget The user's role budget allocation.
 * @param targetPlayers The user's list of target players.
 * @param idToken The user's authentication token.
 */
export const saveStrategy = async (roleBudget: Record<Role, number>, targetPlayers: TargetPlayer[], idToken: string): Promise<void> => {
    if (!idToken) {
        console.warn('Cannot save strategy without a valid idToken.');
        throw new Error("User not authenticated.");
    }
    
    const strategyPayload: UserStrategy = {
        roleBudget: roleBudget,
        targetPlayerIds: targetPlayers.map(p => ({ id: p.id, maxBid: p.maxBid })),
    };

    try {
        const response = await fetch(`${BASE_URL}/api/strategy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(strategyPayload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save strategy.');
        }
    } catch (error) {
        console.error('Error saving strategy:', error);
        throw error;
    }
};

/**
 * Loads the user's strategy from the backend.
 * @param idToken The user's authentication token.
 * @returns The user's strategy or null if not found.
 */
export const loadStrategy = async (authContext: AuthContextType): Promise<UserStrategy | null> => {
    const idToken = authContext?.getLatestToken ? authContext.getLatestToken() : authContext.idToken;
    if (!idToken) return null;

    try {
        const response = await fetch(`${BASE_URL}/api/strategy`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
        });

        if (response.status === 404) {
            return null; // No strategy saved yet, this is not an error.
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to load strategy.');
        }

        return await response.json();
    } catch (error) {
        console.error('Error loading strategy:', error);
        return null; // Return null on error to allow the app to start with defaults.
    }
};

/**
 * Deletes the user's strategy from the backend.
 * @param idToken The user's authentication token.
 */
export const clearStrategy = async (idToken: string): Promise<void> => {
    if (!idToken) return;

    try {
        const response = await fetch(`${BASE_URL}/api/strategy`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete strategy.');
        }
    } catch (error) {
        console.error('Error deleting strategy:', error);
        throw error;
    }
};

// Hook-based API for strategy
export function useStrategyApi() {
    const { call } = useApi();

    const saveStrategy = async (roleBudget: Record<Role, number>, targetPlayers: TargetPlayer[]): Promise<void> => {
        const strategyPayload: UserStrategy = {
            roleBudget: roleBudget,
            targetPlayerIds: targetPlayers.map(p => ({ id: p.id, maxBid: p.maxBid })),
        };
        await call<void>('/api/strategy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(strategyPayload),
        });
    };

    const loadStrategy = async (): Promise<UserStrategy | null> => {
        try {
            return await call<UserStrategy>('/api/strategy', { method: 'GET' });
        } catch (e: any) {
            if (e.message?.includes('404')) return null;
            return null;
        }
    };

    const clearStrategy = async (): Promise<void> => {
        await call<void>('/api/strategy', { method: 'DELETE' });
    };

    return { saveStrategy, loadStrategy, clearStrategy };
}
