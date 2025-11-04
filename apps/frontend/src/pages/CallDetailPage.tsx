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
import { Loader2, ArrowLeft, Pause, Play, Download } from 'lucide-react'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { useQueryClient } from '@tanstack/react-query'
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

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="border border-border/80 bg-card/70 backdrop-blur-sm dark:border-[#242F3F]">
          <CardHeader>
            <CardTitle>Call overview</CardTitle>
            <CardDescription>
              Key details about the participants and timeline for this call.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  label: 'Company',
                  value: displayCompany || 'N/A',
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
            Identifiers and timestamps that support debugging and audits.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
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
        </CardContent>
      </Card>
    </div>
  )
}

export default CallDetailPage
