import { Link } from 'react-router-dom'

// Home page component
export const HomePage = () => (
  <div className="page-container">
    <div className="content-section">
      <h1 className="text-3xl font-bold mb-4">Welcome to Speek It</h1>
      <p className="text-gray-600 mb-6">
        Monitor and analyze your VoIP calls with AI-powered insights.
      </p>
      <Link
        to="/dashboard"
        className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-sm hover:bg-blue-700 transition-colors duration-200"
      >
        Go to VoIP Dashboard
      </Link>
    </div>
  </div>
)

// Not Found page component
export const NotFoundPage = () => (
  <div className="page-container min-h-[80vh] flex items-center justify-center">
    <div className="content-section text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        404 - Page Not Found
      </h1>
      <p className="text-gray-600 mb-6">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-sm hover:bg-blue-700 transition-colors duration-200"
      >
        Go Home
      </Link>
    </div>
  </div>
)
