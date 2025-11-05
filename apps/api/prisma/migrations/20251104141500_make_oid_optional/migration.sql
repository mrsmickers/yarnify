-- Allow Entra users to be provisioned without an oid until first sign-in
ALTER TABLE "entra_users"
ALTER COLUMN "oid" DROP NOT NULL;

