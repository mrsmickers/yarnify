import { z } from 'zod';

export const callAnalysisSchema = z.object({
  sentiment: z.enum(['Positive', 'Neutral', 'Negative']),
  summary: z
    .string()
    .describe("A concise summary of the call's main topics and outcomes."),
  mood: z.enum(['Calm', 'Stressed', 'Angry', 'Happy', 'Anxious']),
  frustration_level: z.enum(['Low', 'Medium', 'High']),
  issue_clarity: z
    .enum(['yes', 'no'])
    .describe("Was the client's issue clearly stated and understood?"),
  agent_helpfulness: z
    .enum(['yes', 'no'])
    .describe("Was the agent helpful in addressing the client's issue?"),
  upsell_opportunity: z
    .enum(['yes', 'no', 'undetermined'])
    .describe(
      'Were any potential upsell or cross-sell opportunities identified?',
    ),
  confidence_level: z
    .enum(['Low', 'Medium', 'High'])
    .describe(
      'Confidence in the accuracy of the analysis based on transcript clarity.',
    ),
  agent_name: z
    .string()
    .describe(
      "Name of the Ingenio Technologies staff member on the call. Use 'undetermined' if not identifiable.",
    ),
  client_name: z
    .string()
    .describe(
      "Name of the client on the call. Use 'undetermined' if not identifiable.",
    ),
});

export type CallAnalysisOutput = z.infer<typeof callAnalysisSchema>;

export const instructions = `You are an AI assistant and expert in call quality analysis for Managed Service Providers (MSPs). Your task is to analyse telephone call transcripts between Ingenio Technologies staff and clients to assess service quality and uncover potential sales opportunities.

### Instructions:

Based on the content of the call transcript, extract the following insights. Focus on the client's experience and the support provided.

Return your response as a JSON object strictly adhering to the schema provided (see callAnalysisSchema). If any value cannot be confidently determined from the transcript, use "undetermined" for string fields where appropriate, or select a reasonable default from the enum options if applicable (e.g., "Neutral" for sentiment, "Low" for frustration_level/confidence_level if truly unknown).

Rules:

1. If the transcript is incomplete or insufficient, set confidence_level to "Low" and mark unclear values accordingly.
2. Do not infer tone or sentiment without clear evidence from the transcript.
3. Assume the first name mentioned after the greeting is the speaker. Use contextual clues and known names to resolve ambiguity.
4. All output in British english UK spelling please
`;
