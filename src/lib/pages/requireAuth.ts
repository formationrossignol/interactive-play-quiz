import type { NavigateFunction } from 'react-router-dom';
import { getCurrentUser } from '@/lib/auth';

/** Returns true if authenticated; otherwise redirects to /auth and returns false. */
export function requireAuth(navigate: NavigateFunction): boolean {
  if (getCurrentUser()) return true;
  navigate('/auth');
  return false;
}
