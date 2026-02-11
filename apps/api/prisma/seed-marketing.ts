import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function seedMarketingSyncs() {
  console.log('Seeding marketing sync configurations...');

  const managedClientSync = await prisma.marketingSync.upsert({
    where: { id: 'seed-marketing-sync-001' },
    update: {},
    create: {
      id: 'seed-marketing-sync-001',
      name: 'Managed Client Newsletter',
      description:
        'Syncs approvers, decision makers and AM contacts from fully managed ConnectWise companies to Encharge for the monthly newsletter.',
      sourceType: 'connectwise',
      destType: 'encharge',
      filterConfig: {
        companyTypes: [48],
        companyExcludeTypes: [35, 5],
        companyStatuses: [1, 19],
        contactTypes: [1, 2, 21],
        contactExcludeTypes: [19],
      },
      tagName: 'managed-client-newsletter',
      schedule: '0 6 * * 1',
      enabled: true,
    },
  });

  console.log(`Created marketing sync: ${managedClientSync.name}`);
  console.log('\nMarketing sync seeding complete!');
}

seedMarketingSyncs()
  .catch((e) => {
    console.error('Error seeding marketing syncs:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
