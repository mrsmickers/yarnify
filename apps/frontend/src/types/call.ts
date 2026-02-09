import { CallResponseDto as BaseCallResponseDto } from '@/api/api-client'

// Extend the base CallResponseDto to include all custom fields
export interface ExtendedCallResponseDto extends BaseCallResponseDto {
  companyName?: string
  // Transfer/grouping fields
  callGroupId?: string
  callLegOrder?: number
  groupSize?: number
  isTransferred?: boolean
  relatedCalls?: ExtendedCallResponseDto[]
  sourceType?: string
  destinationType?: string
}
