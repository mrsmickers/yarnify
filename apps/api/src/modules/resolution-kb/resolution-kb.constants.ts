export const RESOLUTION_KB_CW_API = 'RESOLUTION_KB_CW_API';

// PII patterns for anonymisation
export const PII_PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Phone numbers (UK and international formats)
  phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,
  // IP addresses (IPv4)
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  // API keys / tokens (long hex or alphanumeric strings)
  apiKey: /\b[A-Za-z0-9_-]{32,}\b/g,
  // Passwords (commonly appears as "password: xxx" or "pw: xxx")
  passwordField: /(?:password|passwd|pw|passcode|pin)\s*[:=]\s*\S+/gi,
};

// Default embedding model
export const DEFAULT_EMBEDDING_MODEL = 'nvidia/nv-embedqa-e5-v5';
export const EMBEDDING_DIMENSIONS = 1024;
