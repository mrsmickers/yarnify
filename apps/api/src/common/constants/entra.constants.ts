export const PENDING_ENTRA_OID_PREFIX = 'pending_' as const;

export const isPendingEntraOid = (oid: string | null | undefined): boolean =>
  typeof oid === 'string' && oid.startsWith(PENDING_ENTRA_OID_PREFIX);
