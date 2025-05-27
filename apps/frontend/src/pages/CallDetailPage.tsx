import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCallAnalysisControllerGetCallById } from '@/api/api-client'
import { motion } from 'framer-motion'

const CallDetailPage = () => {
  const { callId } = useParams<{ callId: string }>()

  const {
    data: callDetails,
    isLoading: loading,
    error: queryError,
  } = useCallAnalysisControllerGetCallById(callId!, {
    query: { enabled: !!callId },
  })

  const errorMessage = queryError
    ? (queryError as Error)?.message || 'Failed to fetch call details'
    : null

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
                <div className="flex items-center gap-2 text-blue-100">
                  <span className="text-sm font-medium">ID:</span>
                  <code className="bg-blue-700/30 px-2 py-1 rounded text-sm">
                    {callDetails.id}
                  </code>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-8 space-y-8">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <h4 className="text-xl font-semibold mb-4 text-gray-800">
                  General Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-base">
                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-500">
                        Call SID
                      </span>
                      <span className="font-mono text-gray-700">
                        {callDetails.callSid}
                      </span>
                    </div>
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
                  </div>

                  <div className="space-y-3">
                    {callDetails.duration && (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-500">
                          Duration
                        </span>
                        <span className="text-gray-700">
                          {callDetails.duration} seconds
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-500">
                        Status
                      </span>
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          callDetails.callStatus === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full mr-2 ${
                            callDetails.callStatus === 'COMPLETED'
                              ? 'bg-green-400'
                              : 'bg-yellow-400'
                          }`}
                        ></span>
                        {callDetails.callStatus}
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
                </div>

                {callId && (
                  <div className="mt-6">
                    <h5 className="text-md font-semibold mb-2 text-gray-700">
                      Call Recording
                    </h5>
                    <audio
                      controls
                      src={`/api/v1/storage/recordings/stream/${callId}`}
                      className="w-full"
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </motion.div>

              {callDetails.analysis && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="pt-6 border-t border-gray-200"
                >
                  <h4 className="text-xl font-semibold mb-6 text-gray-800">
                    Call Analysis
                  </h4>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="bg-gray-50 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="text-sm font-medium text-gray-500 mb-1">
                          Overall Sentiment
                        </div>
                        <div className="text-lg text-gray-700">
                          {String(
                            callDetails.analysis.overall_sentiment ?? 'N/A'
                          )}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="text-sm font-medium text-gray-500 mb-1">
                          Customer Mood
                        </div>
                        <div className="text-lg text-gray-700">
                          {String(callDetails.analysis.customer_mood ?? 'N/A')}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="text-sm font-medium text-gray-500 mb-1">
                          Agent Name
                        </div>
                        <div className="text-lg text-gray-700">
                          {String(callDetails.agentName ?? 'N/A')}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="text-sm font-medium text-gray-500 mb-1">
                          AI Confidence
                        </div>
                        <div className="text-lg text-gray-700">
                          {callDetails.analysis.ai_confidence_score
                            ? `${(
                                parseFloat(
                                  String(
                                    callDetails.analysis.ai_confidence_score
                                  )
                                ) * 100
                              ).toFixed(0)}%`
                            : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
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
                          ([key]) =>
                            ![
                              'overall_sentiment',
                              'customer_mood',
                              'summary',
                              'agent_name',
                              'ai_confidence_score',
                            ].includes(key)
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
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export default CallDetailPage
