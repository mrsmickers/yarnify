import { z } from 'zod';

export const callAnalysisSchema = z.object({
  sentiment: z
    .enum(['Positive', 'Neutral', 'Negative', 'Undetermined'])
    .describe('Overall sentiment of the call based on the transcript content.'),
  summary: z
    .string()
    .describe("A concise summary of the call's main topics and outcomes."),
  mood: z.enum([
    'Calm',
    'Stressed',
    'Angry',
    'Happy',
    'Anxious',
    'Undetermined',
  ]),
  frustration_level: z.enum(['Low', 'Medium', 'High', 'Undetermined']),
  issue_clarity: z
    .enum(['yes', 'no', 'Undetermined'])
    .describe("Was the client's issue clearly stated and understood?"),
  agent_helpfulness: z
    .enum(['yes', 'no', 'Undetermined'])
    .describe("Was the agent helpful in addressing the client's issue?"),
  upsell_opportunity: z
    .enum(['yes', 'no', 'Undetermined'])
    .describe(
      'Were any potential upsell or cross-sell opportunities identified?',
    ),
  confidence_level: z
    .enum(['Low', 'Medium', 'High', 'Undetermined'])
    .describe(
      'Confidence in the accuracy of the analysis based on transcript clarity.',
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
6. Use undetermined for any field that cannot be determined from the transcript.
`;
