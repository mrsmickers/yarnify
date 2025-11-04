import { NotFoundPage } from '../routes'
import VoipDashboardPage from '../pages/VoipDashboardPage'
import CallDetailPage from '../pages/CallDetailPage'
import LogoutPage from '../pages/LogoutPage'
import PersonalSettingsPage from '../pages/PersonalSettingsPage'
import AdminConsolePage from '../pages/AdminConsolePage'
import UserManagementPage from '../pages/UserManagementPage'
import ApiCredentialsPage from '../pages/ApiCredentialsPage'

// Route configuration
export const routes = [
  {
    path: '/',
    element: <VoipDashboardPage />,
  },
  {
    path: '/dashboard',
    element: <VoipDashboardPage />,
  },
  {
    path: '/calls/:callId',
    element: <CallDetailPage />,
  },
  {
    path: '/logout',
    element: <LogoutPage />,
  },
  {
    path: '/settings',
    element: <PersonalSettingsPage />,
  },
  {
    path: '/admin',
    element: <AdminConsolePage />,
  },
  {
    path: '/admin/users',
    element: <UserManagementPage />,
  },
  {
    path: '/admin/api-credentials',
    element: <ApiCredentialsPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]
