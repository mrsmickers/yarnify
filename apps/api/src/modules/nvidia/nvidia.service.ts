import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * Service for interacting with NVIDIA NIM API (OpenAI-compatible)
 * Uses Kimi-k2.5 model via NVIDIA's free API tier
 */
@Injectable()
export class NvidiaService {
  private readonly logger = new Logger(NvidiaService.name);
  private readonly client: OpenAI | null = null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('NVIDIA_API_KEY');
    const baseUrl = this.configService.get<string>(
      'NVIDIA_API_URL',
      'https://integrate.api.nvidia.com/v1',
    );
    this.model = this.configService.get<string>(
      'NVIDIA_MODEL',
      'moonshotai/kimi-k2.5',
    );

    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: baseUrl,
      });
      this.logger.log(`NVIDIA LLM service initialized with model: ${this.model}`);
    } else {
      this.logger.warn(
        'NVIDIA_API_KEY not set. NVIDIA LLM services will not be available.',
      );
    }
  }

  /**
   * Check if NVIDIA service is available
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Generate a chat completion using NVIDIA's API
   */
  async createChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    },
  ): Promise<OpenAI.Chat.ChatCompletion> {
    if (!this.client) {
      throw new Error('NVIDIA service not initialized - API key missing');
    }

    this.logger.log(`Creating chat completion with NVIDIA model: ${this.model}`);

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        top_p: options?.topP ?? 1,
        stream: false,
      });

      this.logger.log('NVIDIA chat completion created successfully');
      return completion;
    } catch (error) {
      this.logger.error(
        `Error creating NVIDIA chat completion: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generate a summary of text content
   */
  async generateSummary(
    content: string,
    options?: {
      systemPrompt?: string;
      maxLength?: number;
      style?: 'concise' | 'detailed' | 'bullet-points';
    },
  ): Promise<string> {
    const { systemPrompt, maxLength = 500, style = 'concise' } = options || {};

    const defaultSystemPrompt = `You are an expert summarizer. Create a ${style} summary of the provided content. 
Keep the summary under ${maxLength} words. Focus on the most important information and key insights.
${style === 'bullet-points' ? 'Format your response as bullet points.' : ''}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt || defaultSystemPrompt,
      },
      {
        role: 'user',
        content: `Please summarize the following content:\n\n${content}`,
      },
    ];

    const completion = await this.createChatCompletion(messages, {
      temperature: 0.3,
      maxTokens: Math.min(maxLength * 2, 4096),
    });

    return completion.choices[0]?.message?.content?.trim() || '';
  }

  /**
   * Generate call transcript summary with coaching insights
   */
  async summarizeCallTranscript(
    transcript: string,
    options?: {
      includeCoachingNotes?: boolean;
      includeActionItems?: boolean;
      includeKeyMoments?: boolean;
    },
  ): Promise<{
    summary: string;
    coachingNotes?: string[];
    actionItems?: string[];
    keyMoments?: string[];
  }> {
    const {
      includeCoachingNotes = true,
      includeActionItems = true,
      includeKeyMoments = true,
    } = options || {};

    const systemPrompt = `You are an expert call analyst for a managed IT services provider (MSP).
Analyze the following call transcript and provide:

1. A concise summary (2-3 paragraphs) covering the main discussion points and outcome
${includeCoachingNotes ? '2. Coaching notes for the agent (what they did well, areas for improvement)' : ''}
${includeActionItems ? '3. Action items mentioned or implied in the call' : ''}
${includeKeyMoments ? '4. Key moments (important statements, decisions, or turning points)' : ''}

Format your response as JSON with the following structure:
{
  "summary": "...",
  ${includeCoachingNotes ? '"coachingNotes": ["note1", "note2", ...],' : ''}
  ${includeActionItems ? '"actionItems": ["item1", "item2", ...],' : ''}
  ${includeKeyMoments ? '"keyMoments": ["moment1", "moment2", ...]' : ''}
}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: transcript },
    ];

    const completion = await this.createChatCompletion(messages, {
      temperature: 0.3,
      maxTokens: 2048,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || '{}';

    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { summary: responseText };
    } catch {
      this.logger.warn('Failed to parse NVIDIA response as JSON, returning raw summary');
      return { summary: responseText };
    }
  }

  /**
   * Generate training feedback for a call
   */
  async generateTrainingFeedback(
    transcript: string,
    analysisContext?: {
      sentiment?: string;
      customerSatisfaction?: number;
      issueResolved?: boolean;
    },
  ): Promise<{
    overallScore: number;
    strengths: string[];
    areasForImprovement: string[];
    specificFeedback: string;
    suggestedTraining?: string[];
  }> {
    const contextInfo = analysisContext
      ? `\n\nContext from analysis:
- Sentiment: ${analysisContext.sentiment || 'Unknown'}
- Customer Satisfaction: ${analysisContext.customerSatisfaction || 'N/A'}/5
- Issue Resolved: ${analysisContext.issueResolved ? 'Yes' : 'No'}`
      : '';

    const systemPrompt = `You are a training coach for IT service desk agents at an MSP.
Analyze this call and provide detailed training feedback.${contextInfo}

Respond in JSON format:
{
  "overallScore": <1-10>,
  "strengths": ["strength1", "strength2", ...],
  "areasForImprovement": ["area1", "area2", ...],
  "specificFeedback": "Detailed paragraph of feedback",
  "suggestedTraining": ["training1", "training2", ...]
}

Be constructive and specific. Reference actual moments from the call where possible.`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: transcript },
    ];

    const completion = await this.createChatCompletion(messages, {
      temperature: 0.4,
      maxTokens: 2048,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || '{}';

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {
        overallScore: 5,
        strengths: [],
        areasForImprovement: [],
        specificFeedback: responseText,
      };
    } catch {
      this.logger.warn('Failed to parse training feedback as JSON');
      return {
        overallScore: 5,
        strengths: [],
        areasForImprovement: [],
        specificFeedback: responseText,
      };
    }
  }
}
