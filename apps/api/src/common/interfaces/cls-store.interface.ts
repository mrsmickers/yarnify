/**
 * Interface for the JWT payload that the JwtStrategy's validate() method receives.
 * This typically includes standard JWT claims and any custom claims.
 */
export interface JwtPayload {
  iss?: string; // Issuer
  sub: string; // Subject (usually the user ID)
  aud?: string | string[]; // Audience
  exp?: number; // Expiration Time
  nbf?: number; // Not Before
  iat?: number; // Issued At
  jti?: string; // JWT ID
  // Add any other custom claims from your WorkOS JWT
  email?: string;
  org_id?: string;
  sid?: string; // Session ID from WorkOS token
}

export interface ClsStore {
  userId?: string; // Store only the user ID (from JWT 'sub' claim)
  [key: symbol]: any; // Index signature for symbols
}
