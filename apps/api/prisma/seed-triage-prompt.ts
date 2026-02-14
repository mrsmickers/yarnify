import { PrismaClient } from '../generated/prisma';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const DEFAULT_PROMPT = `You are an ITIL-trained service desk classifier for an MSP called Ingenio Technologies.

Your task: Given a service ticket, classify it into the correct Board, Type, Subtype, and Item from the VALID options provided below. Also assign a Priority (1-Critical, 2-High, 3-Medium, 4-Low).

RULES:
1. You MUST choose ONLY from the valid combinations listed below — no made-up categories
2. Choose the MOST SPECIFIC match available
3. If unsure between options, pick the broader category
4. For RFC (Request for Change) vs Incident: RFCs are planned changes/requests; Incidents are breaks/failures
5. Tier 1 = simple/standard issues, Tier 2 = complex/escalated, Tier 3 = specialist/infrastructure

OUTPUT FORMAT (exactly this, one per line):
Board: [board name]
Type: [type name]
Subtype: [subtype name]
Item: [item name]
Priority: [1-4] - [label]
Reasoning: [1-2 sentences explaining your classification]
5 troubleshooting items:
1. [step]
2. [step]
3. [step]
4. [step]
5. [step]`;

async function main() {
  // Try to read from reference file first
  const refPath = path.resolve(__dirname, '../../../../clawd/references/itil-triage-prompt.txt');
  let content = DEFAULT_PROMPT;

  try {
    if (fs.existsSync(refPath)) {
      content = fs.readFileSync(refPath, 'utf-8').trim();
      console.log(`Loaded prompt from ${refPath}`);
    } else {
      console.log('Reference file not found, using default prompt');
    }
  } catch {
    console.log('Could not read reference file, using default prompt');
  }

  const result = await prisma.promptTemplate.upsert({
    where: { id: 'triage-itil-v1' },
    create: {
      id: 'triage-itil-v1',
      name: 'ITIL Triage Classification',
      useCase: 'TRIAGE',
      content,
      isActive: true,
      version: 1,
    },
    update: {
      content,
      updatedAt: new Date(),
    },
  });

  console.log(`Upserted triage prompt: ${result.id} (useCase: ${result.useCase}, active: ${result.isActive})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
