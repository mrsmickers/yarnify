import { useState, useEffect, FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { axiosInstance, handleApiError } from '@/api/axios-instance'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'
import { Building2, Save, Loader2 } from 'lucide-react'

type CompanyInfo = {
  id: string
  name: string
  description: string
  industry: string | null
  location: string | null
  website: string | null
  additionalContext: string | null
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

export default function CompanyInfoPage() {
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [website, setWebsite] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')

  // Fetch company info
  const { data: companyInfo, isLoading } = useQuery<CompanyInfo | null>({
    queryKey: ['admin', 'company-info'],
    queryFn: async () => {
      return await axiosInstance({
        url: '/api/v1/admin/company-info',
        method: 'GET',
      })
    },
  })

  // Populate form when data loads
  useEffect(() => {
    if (companyInfo) {
      setName(companyInfo.name || '')
      setDescription(companyInfo.description || '')
      setIndustry(companyInfo.industry || '')
      setLocation(companyInfo.location || '')
      setWebsite(companyInfo.website || '')
      setAdditionalContext(companyInfo.additionalContext || '')
    }
  }, [companyInfo])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return await axiosInstance({
        url: '/api/v1/admin/company-info',
        method: 'PUT',
        data: payload,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'company-info'] })
      toast.success('Company info saved successfully')
    },
    onError: (error) => {
      toast.error(handleApiError(error))
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    saveMutation.mutate({
      name,
      description,
      industry: industry || null,
      location: location || null,
      website: website || null,
      additionalContext: additionalContext || null,
    })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="Company Info"
          description="Manage your company details used in AI prompt context."
        />
        <div className="flex h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Company Info"
        description="Manage your company details. This information is injected into all AI prompts so the system understands your organisation."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Details
            </CardTitle>
            <CardDescription>
              Core information about your organisation. This is used as context
              in all AI-generated call analyses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ingenio Technologies Ltd"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. IT Managed Services Provider (MSP)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Brighton, East Sussex, UK"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="e.g. https://ingeniotech.co.uk"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what your company does, your key services, and target market..."
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">
                This description is included in every AI analysis prompt to provide
                business context.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="additionalContext">Additional Context</Label>
              <Textarea
                id="additionalContext"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Any other context the AI should know about (e.g. key products, specialities, staff count, brand voice guidelines)..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Free-text field for anything else the AI should consider when
                analysing calls.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {companyInfo?.updatedAt && (
              <span>
                Last updated: {formatDate(companyInfo.updatedAt)}
                {companyInfo.updatedBy && ` by ${companyInfo.updatedBy}`}
              </span>
            )}
          </div>
          <Button
            type="submit"
            disabled={saveMutation.isPending}
            className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Company Info
          </Button>
        </div>
      </form>
    </div>
  )
}
