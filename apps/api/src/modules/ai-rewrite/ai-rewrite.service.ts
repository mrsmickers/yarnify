import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

type RewriteStyle = 'formal' | 'concise' | 'detailed' | 'technical';

const STYLE_PROMPTS: Record<RewriteStyle, string> = {
  formal: `You are a professional technical writer. Rewrite the following text in a formal, professional tone suitable for business documentation. 
Keep the meaning intact but improve clarity and professionalism. Use British English spelling and conventions.
Output only the rewritten text, nothing else.`,

  concise: `You are an expert at clear, brief communication. Rewrite the following text to be as concise as possible while preserving all key information.
Remove unnecessary words, combine similar points, and get to the point quickly. Use British English spelling.
Output only the rewritten text, nothing else.`,

  detailed: `You are a thorough technical writer. Expand the following text with more context and detail where appropriate.
Add relevant explanations, clarify any ambiguous points, and ensure the message is comprehensive. Use British English spelling and conventions.
Output only the rewritten text, nothing else.`,

  technical: `You are an IT support specialist. Rewrite the following text in technical language suitable for IT service desk documentation.
Include relevant technical terminology, be precise about systems/processes mentioned, and format appropriately for a ticketing system note. Use British English spelling.
Output only the rewritten text, nothing else.`,
};

@Injectable()
export class AiRewriteService {
  private readonly logger = new Logger(AiRewriteService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Get the LLM provider based on configuration
   */
  private getLLMProvider() {
    const llmProvider = this.config.get<string>('LLM_PROVIDER', 'openai');

    if (llmProvider === 'nvidia') {
      const nvidiaApiKey = this.config.get<string>('NVIDIA_API_KEY');
      const nvidiaApiUrl = this.config.get<string>(
        'NVIDIA_API_URL',
        'https://integrate.api.nvidia.com/v1',
      );
      const nvidiaModel = this.config.get<string>(
        'NVIDIA_MODEL',
        'moonshotai/kimi-k2.5',
      );

      if (!nvidiaApiKey) {
        this.logger.warn('NVIDIA_API_KEY not set, falling back to OpenAI');
        return openai('gpt-4o-mini');
      }

      const nvidia = createOpenAI({
        apiKey: nvidiaApiKey,
        baseURL: nvidiaApiUrl,
      });

      this.logger.log(`Using NVIDIA provider with model: ${nvidiaModel}`);
      return nvidia(nvidiaModel);
    }

    return openai('gpt-4o-mini');
  }

  /**
   * Rewrite text in a specified style
   */
  async rewriteText(text: string, style: RewriteStyle): Promise<string> {
    this.logger.log(`Rewriting text in "${style}" style (${text.length} chars)`);

    const systemPrompt = STYLE_PROMPTS[style];
    const model = this.getLLMProvider();

    try {
      const { text: rewrittenText } = await generateText({
        model,
        system: systemPrompt,
        prompt: text,
        temperature: 0.3, // Keep it relatively deterministic
        maxTokens: 2000,
      });

      this.logger.log(
        `Rewrite complete: ${text.length} → ${rewrittenText.length} chars`,
      );
      return rewrittenText.trim();
    } catch (error) {
      this.logger.error('Error rewriting text:', error);
      throw error;
    }
  }
}
