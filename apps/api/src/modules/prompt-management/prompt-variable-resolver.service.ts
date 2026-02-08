import { Injectable } from '@nestjs/common';

/**
 * Resolves {{variable}} placeholders in prompt templates.
 * Variables are use-case specific and resolved at runtime.
 */
@Injectable()
export class PromptVariableResolverService {
  /**
   * Replace all {{variable}} placeholders with actual values.
   * Unrecognised variables are left as-is (graceful).
   */
  resolve(
    template: string,
    variables: Record<string, string | null | undefined>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      return value !== null && value !== undefined ? value : match;
    });
  }

  /**
   * Get available variables for each use case (for UI documentation).
   */
  getAvailableVariables(
    useCase: string,
  ): { name: string; description: string }[] {
    const variablesByUseCase: Record<
      string,
      { name: string; description: string }[]
    > = {
      CALL_ANALYSIS: [
        {
          name: 'company_name',
          description: 'Your company name from Company Info settings',
        },
        {
          name: 'company_description',
          description: 'Your company description',
        },
        {
          name: 'company_industry',
          description: 'Your company industry',
        },
        {
          name: 'company_context',
          description: 'Full formatted company context block',
        },
        {
          name: 'client_name',
          description: "The caller's company name (from ConnectWise)",
        },
        {
          name: 'agent_name',
          description: 'The Ingenio agent on the call',
        },
        {
          name: 'phone_number',
          description: 'The external phone number',
        },
        {
          name: 'transcript',
          description: 'The call transcript text',
        },
      ],
      TRANSCRIPTION_REFINEMENT: [
        {
          name: 'company_name',
          description: 'Your company name',
        },
        {
          name: 'company_context',
          description: 'Full formatted company context block',
        },
        {
          name: 'agent_name',
          description: 'Known agent name (if identified)',
        },
        {
          name: 'caller_company',
          description: 'Known caller company name (if identified)',
        },
      ],
      AGENT_IDENTIFICATION: [
        {
          name: 'company_name',
          description: 'Your company name',
        },
        {
          name: 'agent_list',
          description: 'Comma-separated list of known agent names',
        },
      ],
    };
    return variablesByUseCase[useCase] || [];
  }
}
