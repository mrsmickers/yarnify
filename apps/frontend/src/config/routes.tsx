import { NotFoundPage } from '../routes'
import VoipDashboardPage from '../pages/VoipDashboardPage'
import CallDetailPage from '../pages/CallDetailPage'
import LogoutPage from '../pages/LogoutPage'
import PersonalSettingsPage from '../pages/PersonalSettingsPage'
import AdminConsolePage from '../pages/AdminConsolePage'
import UserManagementPage from '../pages/UserManagementPage'
import AgentManagementPage from '../pages/AgentManagementPage'
import ApiCredentialsPage from '../pages/ApiCredentialsPage'
import PromptManagementPage from '../pages/PromptManagementPage'
import LLMManagementPage from '../pages/LLMManagementPage'
import MarketingPage from '../pages/marketing/MarketingPage'
import KBSearchPage from '../pages/connectwise-search/KBSearchPage'

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
    path: '/admin/agents',
    element: <AgentManagementPage />,
  },
  {
    path: '/admin/api-credentials',
    element: <ApiCredentialsPage />,
  },
  {
    path: '/admin/prompts',
    element: <PromptManagementPage />,
  },
  {
    path: '/admin/llms',
    element: <LLMManagementPage />,
  },
  {
    path: '/connectwise/kb-search',
    element: <KBSearchPage />,
  },
  {
    path: '/marketing',
    element: <MarketingPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]
