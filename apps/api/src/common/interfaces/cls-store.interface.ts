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
  email?: string;
  name?: string;
  tid?: string; // Tenant ID
  oid?: string; // Object ID from Entra
  roles?: string[];
  department?: string; // User's department
  impersonatedBy?: string; // OID of admin who initiated impersonation (if impersonating)
}

export interface ClsStore {
  userId?: string; // Store only the user ID (from JWT 'sub' claim)
  [key: symbol]: any; // Index signature for symbols
}
