export function validateEmail(email: string): boolean {
  const emailRegex = /^\S+@\S+\.\S+$/;
  return emailRegex.test(email);
}

export function validateCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function validatePassword(password: string): boolean {
  return password && password.length >= 6;
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function validateProfileName(name: string): boolean {
  return name && name.trim().length > 0 && name.trim().length <= 50;
}