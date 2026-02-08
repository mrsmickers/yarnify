-- CreateTable
CREATE TABLE "company_info" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "industry" TEXT,
    "location" TEXT,
    "website" TEXT,
    "additionalContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "company_info_pkey" PRIMARY KEY ("id")
);

-- Seed default company info
INSERT INTO "company_info" ("id", "name", "description", "industry", "location", "website", "additionalContext", "createdAt", "updatedAt")
VALUES (
    'default',
    'Ingenio Technologies Ltd',
    'Ingenio Technologies is a managed IT services provider based in Brighton, UK, delivering IT support, cybersecurity, cloud solutions, telephony, and technology consultancy to small and medium businesses. We solve real business problems through practical technology and training.',
    'IT Managed Services Provider (MSP)',
    'Brighton, East Sussex, UK',
    'https://ingeniotech.co.uk',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
