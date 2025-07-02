import { useAuth } from './AuthContext';
import { callApi } from './api';

/**
 * A custom hook to simplify making authenticated API calls from components.
 * It retrieves the idToken from the AuthContext and uses the callApi utility.
 */
export const useApi = () => {
    const { idToken } = useAuth();
    
    const call = <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
        return callApi<T>(endpoint, options, idToken);
    };

    return { call };
};
