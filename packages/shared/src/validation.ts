export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateUsername(u: string): string | null {
  if (!u) return 'Username is required';
  if (!USERNAME_RE.test(u)) return '3–20 characters: letters, numbers and underscores only';
  return null;
}
export function validateEmail(e: string): string | null {
  if (!e) return 'Email is required';
  return EMAIL_RE.test(e.trim()) ? null : 'Enter a valid email address';
}
export function validatePassword(p: string): string | null {
  if (!p) return 'Password is required';
  if (p.length < 8) return 'Use at least 8 characters';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Include at least one letter and one number';
  return null;
}
export function validateBio(b: string): string | null {
  return b.length > 280 ? 'Bio must be 280 characters or fewer' : null;
}
export function validateNote(n: string): string | null {
  return n.length > 4000 ? 'Notes are limited to 4,000 characters' : null;
}
export function validateMessage(m: string): string | null {
  const t = m.trim();
  if (!t) return 'Message is empty';
  return t.length > 4000 ? 'Message is too long' : null;
}
