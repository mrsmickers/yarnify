import { useParams, Link } from 'react-router-dom'
import React, { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import durationPlugin from 'dayjs/plugin/duration'
dayjs.extend(durationPlugin)

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  useCallAnalysisControllerGetCallById,
  useCallAnalysisControllerReprocessCall,
  getCallAnalysisControllerGetCallByIdQueryKey,
  getCallAnalysisControllerGetCallsQueryKey,
  storageControllerDownloadCallTranscript,
} from '@/api/api-client'
import { Loader2, ArrowLeft, Pause, Play, Download, PhoneIncoming, PhoneOutgoing, Phone, ArrowRightLeft, AlertTriangle, GitBranch, Clock, User } from 'lucide-react'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { axiosInstance } from '@/api/axios-instance'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'

const CallDetailPage = () => {
  const { callId } = useParams<{ callId: string }>()
  const queryClient = useQueryClient()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [transcriptLoading, setTranscriptLoading] = useState(false)
  const [transcriptError, setTranscriptError] = useState<string | null>(null)

  const {
    data: callDetails,
    isLoading: loading,
    error: queryError,
  } = useCallAnalysisControllerGetCallById(callId!, {
    query: {
      enabled: !!callId,
      refetchInterval: 10000,
    },
  })

  const errorMessage = queryError
    ? (queryError as Error)?.message || 'Failed to fetch call details'
    : null

  const reprocessMutation = useCallAnalysisControllerReprocessCall<
    void,
    AxiosError<{ message?: string }>
  >()

  // Fetch sentiment alerts for this call
  const { data: sentimentAlerts = [] } = useQuery<Array<{
    id: string
    alertType: string
    severity: string
    sentiment: string | null
    frustration: string | null
    reviewedAt: string | null
    dismissedAt: string | null
  }>>({
    queryKey: ['sentiment-alerts', 'call', callId],
    queryFn: async () => {
      return await axiosInstance({
        url: `/api/v1/admin/sentiment-alerts/call/${callId}`,
        method: 'GET',
      })
    },
    enabled: !!callId,
  })

  const pendingAlerts = sentimentAlerts.filter(
    (a) => !a.reviewedAt && !a.dismissedAt,
  )

  const failedStatuses = ['TRANSCRIPTION_FAILED', 'ANALYSIS_FAILED', 'FAILED']

  const handleReprocess = async () => {
    if (!callId) return
    toast.promise(
      reprocessMutation.mutateAsync({ id: callId }),
      {
        loading: `Requesting reprocessing for call ${callId}...`,
        success: () => {
          if (callId) {
            queryClient.invalidateQueries({
              queryKey: getCallAnalysisControllerGetCallByIdQueryKey(callId),
            })
          }
          queryClient.invalidateQueries({
            queryKey: getCallAnalysisControllerGetCallsQueryKey(),
          })
          return `Call ${callId} has been queued for reprocessing.`
        },
        error: (err: AxiosError<{ message?: string }>) =>
          err.response?.data?.message ||
          err.message ||
          `Failed to reprocess call ${callId}. Please try again.`,
      }
    )
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const setAudioData = () => {
      setDuration(audio.duration)
      setCurrentTime(audio.currentTime)
    }
    const setAudioTime = () => setCurrentTime(audio.currentTime)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('loadeddata', setAudioData)
    audio.addEventListener('timeupdate', setAudioTime)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    if (audio.readyState >= 2) {
      setAudioData()
    }

    return () => {
      audio.removeEventListener('loadeddata', setAudioData)
      audio.removeEventListener('timeupdate', setAudioTime)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [callDetails])

  useEffect(() => {
    if (!callId || !callDetails?.transcriptUrl) {
      setTranscript(null)
      return
    }

    let isMounted = true
    const fetchTranscript = async () => {
      setTranscriptLoading(true)
      setTranscriptError(null)
      try {
        const transcriptText = await storageControllerDownloadCallTranscript(
          callId
        )
        if (!isMounted) return
        if (typeof transcriptText === 'string') {
          setTranscript(transcriptText)
        } else {
          throw new Error('Received unexpected transcript format.')
        }
      } catch (error) {
        if (!isMounted) return
        let message = 'Unknown error fetching transcript'
        if (error instanceof Error) {
          message = error.message
        }
        const axiosError = error as AxiosError
        if (axiosError.isAxiosError && axiosError.response?.data) {
          const responseData = axiosError.response.data as { message?: string }
          if (responseData.message) {
            message = responseData.message
          } else if (
            typeof axiosError.response.data === 'string' &&
            axiosError.response.data.length < 200
          ) {
            message = axiosError.response.data
          }
        }
        setTranscriptError(message)
        setTranscript(null)
      } finally {
        if (isMounted) {
          setTranscriptLoading(false)
        }
      }
    }

    fetchTranscript()
    return () => {
      isMounted = false
    }
  }, [callId, callDetails?.transcriptUrl])

  const handlePlayPause = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying((current) => !current)
  }

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return
    const time = Number(event.target.value)
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }

  const formatTime = (timeInSeconds: number) => {
    const durationValue = dayjs.duration(timeInSeconds, 'seconds')
    if (timeInSeconds >= 60) {
      return `${durationValue.minutes()}m ${durationValue.seconds()}s`
    }
    return `${durationValue.seconds()}s`
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading call details…</span>
        </div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="max-w-md border border-destructive/20 bg-card/70 p-8 text-center shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-lg font-semibold text-destructive">
              Something went wrong
            </CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!callDetails) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="max-w-md border border-border/80 bg-card/70 p-8 text-center shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-lg font-semibold">
              Call not found
            </CardTitle>
            <CardDescription>
              We couldn’t locate this call. It may have been removed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sentiment = String(callDetails.analysis?.sentiment ?? 'Unknown')
  const mood = String(callDetails.analysis?.mood ?? 'N/A')
  const confidence = String(callDetails.analysis?.confidence_level ?? 'N/A')
  const summary = callDetails.analysis?.summary ?? 'No summary available.'
  const analysisEntries = callDetails.analysis
    ? Object.entries(callDetails.analysis).filter(
        ([key]) => !['summary', 'agent_name'].includes(key)
      )
    : []
  const headerDescription = `Review sentiment, participants, and transcript for call ${callDetails.id}.`
  const displayCompany =
    typeof callDetails === 'object' && 'companyName' in callDetails
      ? (callDetails as { companyName: string }).companyName
      : callDetails.companyId

  const directionConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    INBOUND: { label: 'Inbound', icon: PhoneIncoming, className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    OUTBOUND: { label: 'Outbound', icon: PhoneOutgoing, className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    INTERNAL: { label: 'Internal', icon: ArrowRightLeft, className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    UNKNOWN: { label: 'Unknown', icon: Phone, className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  }
  const direction = (callDetails as any).callDirection || 'UNKNOWN'
  const dirInfo = directionConfig[direction] || directionConfig.UNKNOWN
  const DirectionIcon = dirInfo.icon

  const externalPhone = (callDetails as any).externalPhoneNumber || null
  const companyLookup = (callDetails.processingMetadata as any)?.companyLookup

  const formatLabel = (text: string) =>
    text.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

  return (
    <div className="space-y-10">
      <PageHeader
        title="Call analysis"
        description={headerDescription}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
            {callDetails.callStatus &&
              failedStatuses.includes(callDetails.callStatus.toUpperCase()) && (
                <Button
                  type="button"
                  onClick={handleReprocess}
                  className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
                  disabled={reprocessMutation.isPending}
                >
                  {reprocessMutation.isPending
                    ? 'Reprocessing…'
                    : 'Reprocess call'}
                </Button>
              )}
          </>
        }
      />

      {/* Sentiment alert banner */}
      {pendingAlerts.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-400">
              ⚠️ This call has been flagged for review
            </p>
            <p className="text-xs text-amber-400/70">
              {pendingAlerts.length} pending alert{pendingAlerts.length > 1 ? 's' : ''} —{' '}
              {pendingAlerts.map((a) => a.severity).includes('critical')
                ? 'Critical severity'
                : 'Warning severity'}
            </p>
          </div>
          <Button size="sm" variant="outline" asChild className="shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/20">
            <Link to="/admin/sentiment-alerts">Review alerts</Link>
          </Button>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardHeader>
            <CardTitle>Call overview</CardTitle>
            <CardDescription>
              Key details about the participants and timeline for this call.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${dirInfo.className}`}>
                <DirectionIcon className="h-3.5 w-3.5" />
                {dirInfo.label}
              </span>
              {externalPhone && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {externalPhone}
                </span>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  label: 'Company',
                  value: displayCompany || 'N/A',
                  sublabel: !displayCompany && companyLookup?.reason
                    ? companyLookup.reason
                    : undefined,
                },
                {
                  label: 'Agent',
                  value: callDetails.agentName || 'N/A',
                },
                {
                  label: 'Client',
                  value: String(callDetails.analysis?.client_name ?? 'N/A'),
                },
                {
                  label: 'Status',
                  value: callDetails.callStatus || 'Unknown',
                },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    {item.value}
                  </p>
                  {'sublabel' in item && item.sublabel && (
                    <p className="text-[11px] text-amber-400/80">
                      {item.sublabel}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Sentiment', value: sentiment },
                { label: 'Mood', value: mood },
                { label: 'AI confidence', value: confidence },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-foreground"
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-base font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardHeader>
            <CardTitle>Call playback</CardTitle>
            <CardDescription>
              Listen to the recorded conversation or export the audio for audit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <audio
              ref={audioRef}
              src={`/api/v1/storage/recordings/stream/${callId}`}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={handlePlayPause}
                aria-label={isPlaying ? 'Pause recording' : 'Play recording'}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              <div className="flex-1 space-y-2">
                <label
                  htmlFor="timeline-slider"
                  className="flex justify-between text-xs font-medium text-muted-foreground"
                >
                  <span>Timeline</span>
                  <span>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </label>
                <input
                  id="timeline-slider"
                  type="range"
                  min="0"
                  max={Math.max(duration, 0)}
                  value={currentTime}
                  onChange={handleSeek}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[#DEDC00]"
                  disabled={!duration}
                  aria-label="Call recording timeline"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Streaming from secure Ingenio storage.
              </p>
              <Button variant="secondary" asChild>
                <a
                  href={`/api/v1/storage/recordings/${callId}`}
                  download
                  aria-label="Download call recording"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download audio
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
        <CardHeader>
          <CardTitle>AI analysis</CardTitle>
          <CardDescription>
            Summary and intelligence generated for this call.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-5">
            <p className="text-sm leading-relaxed text-foreground/90">
              {summary}
            </p>
          </div>
          {analysisEntries.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {analysisEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-xl border border-border/50 bg-muted/20 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {formatLabel(key)}
                  </p>
                  <p className="mt-2 text-sm text-foreground break-words">
                    {String(value ?? 'N/A')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No additional analysis fields were returned for this call.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Related Calls (Transfer Chain) */}
      {((callDetails as any).isTransferred || (callDetails as any).relatedCalls?.length > 0) && (
        <Card className="border border-purple-500/30 bg-card/70 backdrop-blur-sm dark:border-purple-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-purple-400" />
              <CardTitle>Transfer chain</CardTitle>
            </div>
            <CardDescription>
              This call was transferred. Viewing leg {(callDetails as any).callLegOrder} of {(callDetails as any).groupSize} in the chain.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-4">
              {/* Current call indicator */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500 text-white text-sm font-bold">
                    {(callDetails as any).callLegOrder}
                  </div>
                  {(callDetails as any).relatedCalls?.length > 0 && (
                    <div className="mt-2 h-full w-0.5 bg-purple-500/30" />
                  )}
                </div>
                <div className="flex-1 rounded-lg border-2 border-purple-500/50 bg-purple-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                        Current call
                      </Badge>
                      <span className="text-sm font-medium text-foreground">
                        {callDetails.agentName || 'Unknown agent'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {callDetails.duration ? formatTime(callDetails.duration) : 'N/A'}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(callDetails.startTime).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Related calls */}
              {(callDetails as any).relatedCalls?.map((related: any, index: number) => (
                <div key={related.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-purple-500/50 bg-background text-sm font-medium text-purple-400">
                      {related.callLegOrder}
                    </div>
                    {index < (callDetails as any).relatedCalls.length - 1 && (
                      <div className="mt-2 h-full w-0.5 bg-purple-500/30" />
                    )}
                  </div>
                  <Link
                    to={`/calls/${related.id}`}
                    className="flex-1 rounded-lg border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/40 hover:border-purple-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {related.agentName || 'Unknown agent'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {related.duration ? formatTime(related.duration) : 'N/A'}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(related.startTime).toLocaleString()}
                    </p>
                    {related.analysis?.sentiment && (
                      <Badge
                        variant="outline"
                        className={`mt-2 text-[10px] ${
                          related.analysis.sentiment === 'Positive'
                            ? 'border-green-500/30 text-green-400'
                            : related.analysis.sentiment === 'Negative'
                            ? 'border-red-500/30 text-red-400'
                            : 'border-yellow-500/30 text-yellow-400'
                        }`}
                      >
                        {related.analysis.sentiment}
                      </Badge>
                    )}
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {callDetails?.transcriptUrl ? (
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardHeader>
            <CardTitle>Call transcript</CardTitle>
            <CardDescription>
              Complete transcript generated from automated speech recognition.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transcriptLoading && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading transcript…
              </div>
            )}
            {transcriptError && (
              <p className="text-sm font-medium text-destructive">
                {transcriptError}
              </p>
            )}
            {transcript && !transcriptLoading && !transcriptError ? (
              <div className="max-h-96 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-5">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {transcript}
                </pre>
              </div>
            ) : null}
            {!transcript && !transcriptLoading && !transcriptError && (
              <p className="text-sm text-muted-foreground">
                Transcript not available or failed to load.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
        <CardHeader>
          <CardTitle>Technical info</CardTitle>
          <CardDescription>
            Identifiers, timestamps, and LLM pipeline details for debugging and audits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Call SID
              </span>
              <span className="break-all text-sm font-medium text-foreground">
                {callDetails.callSid}
              </span>
            </div>
            <div className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Started
              </span>
              <span className="text-sm font-medium text-foreground">
                {new Date(callDetails.startTime).toLocaleString()}
              </span>
            </div>
            {callDetails.endTime ? (
              <div className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ended
                </span>
                <span className="text-sm font-medium text-foreground">
                  {new Date(callDetails.endTime).toLocaleString()}
                </span>
              </div>
            ) : null}
            {callDetails.duration ? (
              <div className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Duration
                </span>
                <span className="text-sm font-medium text-foreground">
                  {formatTime(callDetails.duration)}
                </span>
              </div>
            ) : null}
          </div>

          {callDetails.processingMetadata ? (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                LLM Pipeline
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: 'Transcription',
                    provider: callDetails.processingMetadata.transcription?.provider,
                    model: callDetails.processingMetadata.transcription?.model,
                    color: 'text-blue-400',
                  },
                  {
                    label: 'Refinement',
                    provider: callDetails.processingMetadata.refinement?.provider,
                    model: callDetails.processingMetadata.refinement?.model,
                    color: callDetails.processingMetadata.refinement?.provider === 'skipped' ? 'text-zinc-500' : 'text-purple-400',
                  },
                  {
                    label: 'Analysis',
                    provider: callDetails.processingMetadata.analysis?.provider,
                    model: callDetails.processingMetadata.analysis?.model,
                    color: 'text-purple-400',
                  },
                  {
                    label: 'Embeddings',
                    provider: callDetails.processingMetadata.embeddings?.provider,
                    model: callDetails.processingMetadata.embeddings?.model,
                    color: callDetails.processingMetadata.embeddings?.provider === 'skipped' ? 'text-zinc-500' : 'text-blue-400',
                  },
                ].map((step) => (
                  <div
                    key={step.label}
                    className="rounded-xl border border-border/60 bg-muted/20 p-3"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {step.label}
                    </span>
                    <p className={`mt-1 text-xs font-semibold ${step.color}`}>
                      {step.provider || 'N/A'}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={step.model || undefined}>
                      {step.model || '—'}
                    </p>
                  </div>
                ))}
              </div>
              {callDetails.processingMetadata.processedAt ? (
                <p className="text-[11px] text-muted-foreground">
                  Processed {new Date(callDetails.processingMetadata.processedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export default CallDetailPage
