import { CallResponseDto as BaseCallResponseDto } from '@/api/api-client'

// Extend the base CallResponseDto to include companyName
export interface ExtendedCallResponseDto extends BaseCallResponseDto {
  companyName?: string
}
