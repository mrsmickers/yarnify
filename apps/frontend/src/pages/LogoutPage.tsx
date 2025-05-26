import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const LogoutPage = () => {
  const navigate = useNavigate()

  useEffect(() => {
    // Navigate back to home page after a brief delay to allow for animations/messages
    const timer = setTimeout(() => {
      navigate('/', { replace: true })
    }, 1500)

    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="page-container min-h-[80vh] flex items-center justify-center">
      <div className="content-section text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Signing you out...
        </h1>
        <p className="text-gray-600 mb-6">
          Thank you for using Speek It. See you next time!
        </p>
      </div>
    </div>
  )
}

export default LogoutPage
