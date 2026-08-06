export const validatePasswordStrength = (password) => {
  if (!password) return false;
  
  if (password.length < 8) return false;
  if (password.length > 128) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9\s]/.test(password)) return false;
  if (/\s/.test(password)) return false;
  
  if (password === 'Student@123' || password === 'Faculty@123') return false;
  
  return true;
};
