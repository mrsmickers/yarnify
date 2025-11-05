import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function seedPromptsAndLLMs() {
  console.log('Seeding prompts and LLM configurations...');

  // Seed Transcription Refinement Prompt
  const transcriptionRefinementPrompt = await prisma.promptTemplate.upsert({
    where: { id: 'seed-transcription-refinement-001' },
    update: {},
    create: {
      id: 'seed-transcription-refinement-001',
      name: 'Default Transcription Refinement',
      useCase: 'TRANSCRIPTION_REFINEMENT',
      content: `You are a helpful assistant that refines raw speech-to-text transcripts. Your goal is to make the transcript more readable by correcting grammar, punctuation, and sentence structure. If possible, identify different speakers and format the transcript accordingly (e.g., Speaker 1:, Speaker 2:). Do not summarize or change the meaning of the content. Output only the refined transcript text.`,
      isActive: true,
      version: 1,
    },
  });

  console.log('✓ Created Transcription Refinement Prompt');

  // Seed Call Analysis Prompt
  const callAnalysisPrompt = await prisma.promptTemplate.upsert({
    where: { id: 'seed-call-analysis-001' },
    update: {},
    create: {
      id: 'seed-call-analysis-001',
      name: 'Default Call Analysis',
      useCase: 'CALL_ANALYSIS',
      content: `You are an AI assistant and expert in call quality analysis for Managed Service Providers (MSPs). Your task is to analyse telephone call transcripts between Ingenio Technologies staff and clients to assess service quality and uncover potential sales opportunities.

### Instructions:

Based on the content of the call transcript, extract the following insights. Focus on the client's experience and the support provided.

Return your response as a JSON object strictly adhering to the schema provided (see callAnalysisSchema). If any value cannot be confidently determined from the transcript:
  - For string fields (like agent_name, client_name, summary), use the string "undetermined" if the information is not present or clear.
  - For enum fields, you MUST select one of the explicitly defined enum values for that specific field. If a value is truly unknown or not applicable based on the transcript:
    - For 'upsell_opportunity', you MAY use "undetermined" as it is a valid option.
    - For other enum fields (sentiment, mood, frustration_level, issue_clarity, agent_helpfulness, confidence_level), select the most neutral or least specific valid option if the information is unclear (e.g., "Neutral" for sentiment; "Low" for frustration_level or confidence_level). Do NOT use the string "undetermined" for these fields unless it is explicitly listed as a valid enum option for them.

Rules:

1. If the transcript is incomplete or insufficient, set confidence_level to "Low" and mark unclear values accordingly.
2. Do not infer tone or sentiment without clear evidence from the transcript.
3. Assume the first name mentioned after the greeting is the speaker. Use contextual clues and known names to resolve ambiguity.
4. All output in British english UK spelling please
5. Use the agent name passed in the user prompt if available, otherwise use "undetermined".
6. Use undetermined for any field that cannot be determined from the transcript.`,
      isActive: true,
      version: 1,
    },
  });

  console.log('✓ Created Call Analysis Prompt');

  // Seed Transcription LLM Config (Whisper)
  const transcriptionLLM = await prisma.lLMConfiguration.upsert({
    where: { id: 'seed-llm-transcription-001' },
    update: {},
    create: {
      id: 'seed-llm-transcription-001',
      name: 'Whisper v1 (Default)',
      useCase: 'TRANSCRIPTION',
      modelName: 'whisper-1',
      provider: 'openai',
      isActive: true,
      settings: {},
    },
  });

  console.log('✓ Created Transcription LLM Config');

  // Seed Transcription Refinement LLM Config
  const refinementLLM = await prisma.lLMConfiguration.upsert({
    where: { id: 'seed-llm-refinement-001' },
    update: {},
    create: {
      id: 'seed-llm-refinement-001',
      name: 'GPT-4o Refinement (Default)',
      useCase: 'TRANSCRIPTION_REFINEMENT',
      modelName: 'gpt-4o',
      provider: 'openai',
      isActive: true,
      settings: {
        temperature: 0.2,
      },
    },
  });

  console.log('✓ Created Transcription Refinement LLM Config');

  // Seed Call Analysis LLM Config
  const analysisLLM = await prisma.lLMConfiguration.upsert({
    where: { id: 'seed-llm-analysis-001' },
    update: {},
    create: {
      id: 'seed-llm-analysis-001',
      name: 'GPT-4o Analysis (Default)',
      useCase: 'CALL_ANALYSIS',
      modelName: 'gpt-4o',
      provider: 'openai',
      isActive: true,
      settings: {
        response_format: 'json_object',
      },
    },
  });

  console.log('✓ Created Call Analysis LLM Config');

  // Seed Embeddings LLM Config
  const embeddingsLLM = await prisma.lLMConfiguration.upsert({
    where: { id: 'seed-llm-embeddings-001' },
    update: {},
    create: {
      id: 'seed-llm-embeddings-001',
      name: 'Text Embedding 3 Small (Default)',
      useCase: 'EMBEDDINGS',
      modelName: 'text-embedding-3-small',
      provider: 'openai',
      isActive: true,
      settings: {},
    },
  });

  console.log('✓ Created Embeddings LLM Config');

  console.log('\n✅ Seeding complete!');
  console.log('\nActive Configurations:');
  console.log(`- Transcription: ${transcriptionLLM.name}`);
  console.log(`- Refinement: ${refinementLLM.name}`);
  console.log(`- Analysis: ${analysisLLM.name}`);
  console.log(`- Embeddings: ${embeddingsLLM.name}`);
}

seedPromptsAndLLMs()
  .catch((e) => {
    console.error('Error seeding prompts and LLMs:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

