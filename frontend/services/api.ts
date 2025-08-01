/**
 * A utility function to make API calls, automatically handling Authorization headers.
 * This is a plain function to avoid React hook-related circular dependencies.
 * @param endpoint The API endpoint to call.
 * @param options The standard fetch options.
 * @param token An optional JWT to include in the Authorization header.
 * @returns The JSON response from the API.
 */
export const callApi = async <T>(endpoint: string, options: RequestInit = {}, token?: string | null): Promise<T> => {
    const headers = new Headers(options.headers || {});
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    if (options.body && !(options.body instanceof FormData) && typeof options.body === 'string') {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(endpoint, {
        ...options,
        headers,
    });

    let responseBody: string | undefined;
    try {
        responseBody = await response.clone().text();
    } catch {}

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { message: responseBody || `API call failed with status ${response.status}` };
        }
        // Log the error body for debugging
        console.error('API error:', errorData);
        throw new Error(errorData?.error || errorData?.message || `API call failed with status ${response.status}`);
    }

    if (response.status === 204) { // No Content
        return {} as T;
    }

    // Try to parse as JSON, but if it's not, log and throw a clear error
    try {
        return await response.json();
    } catch (e) {
        console.error('API returned non-JSON response:', e);
        throw new Error('API returned non-JSON response');
    }
};

// Export a base_url for API calls
const BASE_URL = import.meta.env.VITE_API_URL;
export const base_url = BASE_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : '');
