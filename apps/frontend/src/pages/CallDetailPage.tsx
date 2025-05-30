import { useParams, Link } from 'react-router-dom'
import React, { useRef, useState, useEffect } from 'react'
import dayjs from 'dayjs'
import durationPlugin from 'dayjs/plugin/duration'
dayjs.extend(durationPlugin)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useCallAnalysisControllerGetCallById,
  useCallAnalysisControllerReprocessCall,
  getCallAnalysisControllerGetCallByIdQueryKey, // Corrected import
  getCallAnalysisControllerGetCallsQueryKey, // Added
  storageControllerDownloadCallTranscript,
} from '@/api/api-client'
import { Play, Pause, Download } from 'lucide-react' // Added lucide-react icons
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { AxiosError } from 'axios' // Removed AxiosResponse
import { useQueryClient } from '@tanstack/react-query' // Added

const CallDetailPage = () => {
  const { callId } = useParams<{ callId: string }>()
  const queryClient = useQueryClient() // Added
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
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  })

  const errorMessage = queryError
    ? (queryError as Error)?.message || 'Failed to fetch call details'
    : null

  const reprocessMutation = useCallAnalysisControllerReprocessCall<
    void, // Orval types 202/204 responses as void
    AxiosError<{ message?: string }> // For error handling
  >()

  const failedStatuses = ['TRANSCRIPTION_FAILED', 'ANALYSIS_FAILED', 'FAILED'] // Define failed statuses

  const handleReprocess = async () => {
    if (!callId) return
    toast.promise(
      reprocessMutation.mutateAsync({ id: callId }), // This promise resolves to void as per Orval's typing for 202
      {
        loading: `Requesting reprocessing for call ${callId}...`,
        success: () => {
          // Since the promise resolves to void, the 'data' argument here would be undefined.
          // We provide a generic success message.
          // To get the actual message from the backend, one would typically expect
          // the API client to be generated to return the actual response body,
          // or handle this in a global response interceptor for axiosInstance.
          // For now, a generic message is the most type-safe approach given the generated types.
          if (callId) {
            queryClient.invalidateQueries({
              queryKey: getCallAnalysisControllerGetCallByIdQueryKey(callId),
            })
          }
          queryClient.invalidateQueries({
            queryKey: getCallAnalysisControllerGetCallsQueryKey(), // Invalidate list for dashboard
          })
          return `Call ${callId} has been queued for reprocessing.`
        },
        error: (err: AxiosError<{ message?: string }>) => {
          return (
            err.response?.data?.message ||
            err.message ||
            `Failed to reprocess call ${callId}. Please try again.`
          )
        },
      }
    )
  }

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      const setAudioData = () => {
        setDuration(audio.duration)
        setCurrentTime(audio.currentTime)
      }

      const setAudioTime = () => setCurrentTime(audio.currentTime)

      audio.addEventListener('loadeddata', setAudioData)
      audio.addEventListener('timeupdate', setAudioTime)
      audio.addEventListener('play', () => setIsPlaying(true))
      audio.addEventListener('pause', () => setIsPlaying(false))
      audio.addEventListener('ended', () => setIsPlaying(false))

      // Set initial data in case loadeddata already fired
      if (audio.readyState >= 2) {
        // HAVE_CURRENT_DATA or more
        setAudioData()
      }

      return () => {
        audio.removeEventListener('loadeddata', setAudioData)
        audio.removeEventListener('timeupdate', setAudioTime)
        audio.removeEventListener('play', () => setIsPlaying(true))
        audio.removeEventListener('pause', () => setIsPlaying(false))
        audio.removeEventListener('ended', () => setIsPlaying(false))
      }
    }
  }, [callDetails]) // Re-run if callDetails changes, implying audio src might change

  useEffect(() => {
    if (callId && callDetails?.transcriptUrl) {
      const fetchTranscript = async () => {
        setTranscriptLoading(true)
        setTranscriptError(null)
        try {
          // Use the Orval-generated API client function.
          // After regeneration, it should directly return the string data for text/plain.
          const transcriptText = await storageControllerDownloadCallTranscript(
            callId!
          )

          if (typeof transcriptText === 'string') {
            setTranscript(transcriptText)
          } else {
            console.error(
              'Transcript data is not a string after regeneration:',
              transcriptText
            )
            throw new Error('Received unexpected transcript format.')
          }
        } catch (error) {
          console.error('Error fetching transcript:', error)
          let message = 'Unknown error fetching transcript'
          if (error instanceof Error) {
            message = error.message
          }
          const axiosError = error as AxiosError
          if (axiosError.isAxiosError && axiosError.response?.data) {
            const responseData = axiosError.response.data as {
              message?: string
            }
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
          setTranscriptLoading(false)
        }
      } // Semicolon to correctly close the function expression
      fetchTranscript()
    } else {
      setTranscript(null) // Clear transcript if no URL or callId
    }
  }, [callId, callDetails?.transcriptUrl])

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const time = Number(event.target.value)
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const formatTime = (timeInSeconds: number) => {
    const duration = dayjs.duration(timeInSeconds, 'seconds')
    if (timeInSeconds >= 60) {
      return `${duration.minutes()}m ${duration.seconds()}s`
    }
    return `${duration.seconds()}s`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl text-gray-700">Loading call details...</p>
        </div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-xl text-red-500 mb-4">{errorMessage}</p>
          <Link
            to="/dashboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 transition-all duration-200 inline-flex items-center"
          >
            &larr; Return to Dashboard
          </Link>
        </motion.div>
      </div>
    )
  }

  if (!callDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-xl text-gray-700 mb-4">Call not found.</p>
          <Link
            to="/dashboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 transition-all duration-200 inline-flex items-center"
          >
            &larr; Return to Dashboard
          </Link>
        </motion.div>
      </div>
    )
  }

  const displayCompany =
    typeof callDetails === 'object' && 'companyName' in callDetails
      ? (callDetails as { companyName: string }).companyName
      : callDetails.companyId

  return (
    <div className="page-container min-h-screen py-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Link
            to="/dashboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-md hover:shadow-lg hover:bg-blue-700 transition-all duration-200 inline-flex items-center gap-2"
          >
            <span>&larr;</span>
            <span>Back to Dashboard</span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="w-full max-w-4xl mx-auto shadow-2xl backdrop-blur-sm bg-white/95">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-md p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-3xl font-bold tracking-tight">
                  Call Details
                </CardTitle>
                {/* Remove ID from header */}
                {callDetails.callStatus &&
                  failedStatuses.includes(
                    callDetails.callStatus.toUpperCase()
                  ) && (
                    <Button
                      onClick={handleReprocess}
                      variant="outline"
                      size="sm"
                      className="bg-yellow-500 hover:bg-yellow-600 text-white mt-2 sm:mt-0"
                      disabled={reprocessMutation.isPending}
                    >
                      {reprocessMutation.isPending
                        ? 'Reprocessing...'
                        : 'Reprocess Call'}
                    </Button>
                  )}
              </div>
            </CardHeader>

            <CardContent className="p-8 space-y-8">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <h4 className="text-xl font-semibold mb-4 text-gray-800">
                  General Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-base">
                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-500">
                        Company Contact
                      </span>
                      <span className="text-gray-700">
                        {String(callDetails.analysis?.client_name ?? 'N/A')}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-500">
                        Agent Name
                      </span>
                      <span className="text-gray-700">
                        {String(callDetails.agentName ?? 'N/A')}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-500">
                        Company
                      </span>
                      <span className="text-gray-700">
                        {displayCompany || 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-500">
                        Start Time
                      </span>
                      <span className="text-gray-700">
                        {new Date(callDetails.startTime).toLocaleString()}
                      </span>
                    </div>
                    {callDetails.endTime && (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-500">
                          End Time
                        </span>
                        <span className="text-gray-700">
                          {new Date(callDetails.endTime).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {callDetails.duration && (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-500">
                          Duration
                        </span>
                        <span className="text-gray-700">
                          {formatTime(callDetails.duration)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Move Call Recording section after Call Analysis */}
              </motion.div>

              {/* Call Analysis Section - Moved up */}
              {callDetails.analysis && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="pt-6 border-t border-gray-200"
                >
                  <h4 className="text-xl font-semibold mb-6 text-gray-800">
                    Call Analysis
                  </h4>
                  <div className="space-y-6">
                    <div className="bg-gray-50 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow duration-200 mb-6">
                      <div className="text-sm font-medium text-gray-500 mb-2">
                        Summary
                      </div>
                      <p className="text-gray-700 leading-relaxed">
                        {String(callDetails.analysis.summary ?? 'N/A')}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(() => {
                        const dynamicAnalysis = Object.entries(
                          callDetails.analysis
                        ).filter(
                          ([key]) => !['summary', 'agent_name'].includes(key)
                        )
                        return dynamicAnalysis.map(([key, value], index) => (
                          <motion.div
                            key={key}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * index }}
                            className="bg-gray-50/80 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:bg-white"
                          >
                            <div className="text-sm font-medium text-gray-500 mb-1">
                              {key
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </div>
                            <div className="text-gray-700 break-words">
                              {String(value ?? 'N/A')}
                            </div>
                          </motion.div>
                        ))
                      })()}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Transcript Section - Moved down */}
              {callDetails?.transcriptUrl && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }} // Already correct
                  className="pt-6 border-t border-gray-200"
                >
                  <h4 className="text-xl font-semibold mb-4 text-gray-800">
                    Call Transcript
                  </h4>
                  {transcriptLoading && <p>Loading transcript...</p>}
                  {transcriptError && (
                    <p className="text-red-500">Error: {transcriptError}</p>
                  )}
                  {transcript && !transcriptLoading && !transcriptError && (
                    <Card className="bg-gray-50/80 shadow-sm max-h-96 overflow-y-auto">
                      <CardContent className="p-4">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-mono">
                          {transcript}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                  {!transcript && !transcriptLoading && !transcriptError && (
                    <p className="text-gray-500">
                      Transcript not available or failed to load.
                    </p>
                  )}
                </motion.div>
              )}

              {/* Call Recording Section */}
              {callId && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="pt-6 border-t border-gray-200"
                >
                  <h4 className="text-xl font-semibold mb-4 text-gray-800">
                    Call Recording
                  </h4>
                  <div className="mt-2">
                    <audio
                      ref={audioRef}
                      src={`/api/v1/storage/recordings/stream/${callId}`}
                      className="w-full hidden"
                      onLoadedMetadata={() => {
                        if (audioRef.current)
                          setDuration(audioRef.current.duration)
                      }}
                      onTimeUpdate={() => {
                        if (audioRef.current)
                          setCurrentTime(audioRef.current.currentTime)
                      }}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    />
                    <div className="mt-2 flex items-center space-x-2">
                      <button
                        onClick={handlePlayPause}
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        aria-label={
                          isPlaying ? 'Pause recording' : 'Play recording'
                        }
                      >
                        {isPlaying ? (
                          <Pause className="h-5 w-5" fill="currentColor" />
                        ) : (
                          <Play className="h-5 w-5" fill="currentColor" />
                        )}
                      </button>
                      <label htmlFor="timeline-slider" className="sr-only">
                        Call Recording Timeline
                      </label>
                      <input
                        id="timeline-slider"
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        disabled={!duration}
                        aria-label="Call recording timeline"
                      />
                      <div className="text-sm text-gray-600 w-24 text-right">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </div>
                      <a
                        href={`/api/v1/storage/recordings/${callId}`}
                        download
                        className="ml-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-3 rounded text-sm"
                        aria-label="Download call recording"
                        title="Download Recording"
                      >
                        <Download className="h-4 w-4" />
                        <noscript>
                          <audio
                            controls
                            src={`/api/v1/storage/recordings/stream/${callId}`}
                          >
                            Your browser does not support the audio element.
                          </audio>
                        </noscript>
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Technical Info Section */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="pt-6 border-t border-gray-200"
              >
                <h4 className="text-xl font-semibold mb-4 text-gray-800">
                  Technical Info
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 md:col-span-2">
                    <span className="text-sm font-medium text-gray-500 block mb-1">
                      Call SID
                    </span>
                    <span className="text-gray-700 break-all">
                      {callDetails.callSid}
                    </span>
                  </div>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export default CallDetailPage
