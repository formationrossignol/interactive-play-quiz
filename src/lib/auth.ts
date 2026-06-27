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

async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

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

export const login = async (email: string, password: string): Promise<User | null> => {
  const usersStr = localStorage.getItem('quiz_users');
  let users: User[] = [];
  try { users = usersStr ? JSON.parse(usersStr) : []; } catch { users = []; }

  const user = users.find(u => u.email === email);
  if (!user) return null;

  const passwordsStr = localStorage.getItem('quiz_passwords');
  let passwords: Record<string, string> = {};
  try { passwords = passwordsStr ? JSON.parse(passwordsStr) : {}; } catch { passwords = {}; }

  const hash = await hashPassword(password);
  if (passwords[user.id] !== hash) return null;

  setCurrentUser(user);
  return user;
};

export const register = async (email: string, username: string, password: string): Promise<User | null> => {
  const usersStr = localStorage.getItem('quiz_users');
  let users: User[] = [];
  try { users = usersStr ? JSON.parse(usersStr) : []; } catch { users = []; }

  if (users.some(u => u.email === email)) return null;

  const newUser: User = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    email,
    username,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  localStorage.setItem('quiz_users', JSON.stringify(users));

  const passwordsStr = localStorage.getItem('quiz_passwords');
  let passwords: Record<string, string> = {};
  try { passwords = passwordsStr ? JSON.parse(passwordsStr) : {}; } catch { passwords = {}; }
  passwords[newUser.id] = await hashPassword(password);
  localStorage.setItem('quiz_passwords', JSON.stringify(passwords));

  setCurrentUser(newUser);
  return newUser;
};
