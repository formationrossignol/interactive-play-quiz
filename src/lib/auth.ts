export type Theme = 'light' | 'dark';
export type Language = 'en' | 'fr';

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  theme?: Theme;
  language?: Language;
}

export const AUTH_STORAGE_KEY = 'quiz_auth_user';

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const setCurrentUser = (user: User) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
};

export const logout = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const login = (email: string, password: string): User | null => {
  // Get all users from localStorage
  const usersStr = localStorage.getItem('quiz_users');
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];
  
  // Find user by email
  const user = users.find(u => u.email === email);
  if (!user) return null;
  
  // Check password (stored in separate key for "security")
  const passwordsStr = localStorage.getItem('quiz_passwords');
  const passwords: Record<string, string> = passwordsStr ? JSON.parse(passwordsStr) : {};
  
  if (passwords[user.id] !== password) return null;
  
  setCurrentUser(user);
  return user;
};

export const register = (email: string, username: string, password: string): User | null => {
  // Get existing users
  const usersStr = localStorage.getItem('quiz_users');
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];
  
  // Check if email already exists
  if (users.some(u => u.email === email)) return null;
  
  // Create new user
  const newUser: User = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    email,
    username,
    createdAt: new Date().toISOString()
  };
  
  // Save user
  users.push(newUser);
  localStorage.setItem('quiz_users', JSON.stringify(users));
  
  // Save password
  const passwordsStr = localStorage.getItem('quiz_passwords');
  const passwords: Record<string, string> = passwordsStr ? JSON.parse(passwordsStr) : {};
  passwords[newUser.id] = password;
  localStorage.setItem('quiz_passwords', JSON.stringify(passwords));
  
  setCurrentUser(newUser);
  return newUser;
};
