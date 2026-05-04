// Stores, retrieves, and removes the JWT access token from localStorage

const TOKEN_KEY = 'access_token';

export const saveToken = (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
};

export const removeToken = (): void => {
    localStorage.removeItem(TOKEN_KEY);
};

export const isAuthenticated = (): boolean => {
    return getToken() !== null;
};

// Sends credentials to Django and stores the returned access token
export const login = async (username: string, password: string): Promise<void> => {
    const response = await fetch('http://localhost:8000/api/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
        throw new Error('Invalid username or password');
    }

    const data = await response.json();
    // data.access is the JWT access token returned by SimpleJWT
    saveToken(data.access);
};

export const logout = (): void => {
    removeToken();
};