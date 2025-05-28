import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetCallsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Start date for filtering (ISO 8601 format)',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => value && new Date(value))
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'End date for filtering (ISO 8601 format)',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => value && new Date(value))
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Company ID to filter by',
    type: String,
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Agent ID to filter by',
    type: String,
  })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({
    description: 'Sentiment to filter by (e.g., Positive, Negative, Neutral)',
    type: String,
  })
  @IsOptional()
  @IsString()
  sentiment?: string;

  @ApiPropertyOptional({
    description:
      'Call status to filter by (e.g., PROCESSING, COMPLETED, FAILED)',
    type: String,
  })
  @IsOptional()
  @IsString() // In NestJS, enums from query params are often strings
  status?: string;

  @ApiPropertyOptional({
    description: 'Search term for call SID or other relevant fields',
    type: String,
  })
  @IsOptional()
  @IsString()
  searchTerm?: string;
}

// Basic DTO for a single call in the response
// This should be expanded based on what data needs to be returned
export class CallResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  callSid: string;

  @ApiPropertyOptional()
  companyId?: string;

  @ApiProperty()
  startTime: Date;

  @ApiPropertyOptional()
  endTime?: Date;

  @ApiPropertyOptional()
  duration?: number;

  @ApiPropertyOptional({ description: 'URL to the stored transcript file' })
  transcriptUrl?: string;

  @ApiProperty({
    description: 'Status of the call (e.g., PROCESSING, COMPLETED, FAILED)',
  })
  callStatus: string;

  @ApiPropertyOptional()
  analysis?: any; // Replace 'any' with a more specific CallAnalysisResponseDto if needed

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  agentName?: string; // Optional: include agent name if available
}

export class CallMetricsDto {
  @ApiProperty({ description: 'Total number of positive sentiment calls' })
  totalPositiveSentiment: number;

  @ApiProperty({ description: 'Total number of negative sentiment calls' })
  totalNegativeSentiment: number;

  @ApiProperty({ description: 'Total number of neutral sentiment calls' })
  totalNeutralSentiment: number;

  @ApiProperty({ description: 'Average AI confidence score across all calls' })
  averageConfidence: number;
}

export class PaginatedCallsResponseDto {
  @ApiProperty({ type: [CallResponseDto] })
  data: CallResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty({ type: CallMetricsDto })
  metrics: CallMetricsDto;
}

export class CompanyListItemDto {
  @ApiProperty({ description: 'Company ID' })
  id: string;

  @ApiProperty({ description: 'Company Name' })
  name: string;
}

export class AgentListItemDto {
  @ApiProperty({ description: 'Agent ID' })
  id: string;

  @ApiProperty({ description: 'Agent Name' })
  name: string;
}
