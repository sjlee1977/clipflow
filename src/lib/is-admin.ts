export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmail = process.env.ADMIN_EMAIL ?? '';
  return email.toLowerCase() === adminEmail.toLowerCase();
}
