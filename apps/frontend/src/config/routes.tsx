import { NotFoundPage } from '../routes'
import DashboardPage from '../pages/DashboardPage'
import VoipDashboardPage from '../pages/VoipDashboardPage'
import CallDetailPage from '../pages/CallDetailPage'
import MyCallsPage from '../pages/MyCallsPage'
import LogoutPage from '../pages/LogoutPage'
import PersonalSettingsPage from '../pages/PersonalSettingsPage'
import AdminConsolePage from '../pages/AdminConsolePage'
import UserManagementPage from '../pages/UserManagementPage'
import AgentManagementPage from '../pages/AgentManagementPage'
import ApiCredentialsPage from '../pages/ApiCredentialsPage'
import PromptManagementPage from '../pages/PromptManagementPage'
import LLMManagementPage from '../pages/LLMManagementPage'
import CompanyInfoPage from '../pages/CompanyInfoPage'
import TrainingRulesPage from '../pages/TrainingRulesPage'
import ScoringCategoriesPage from '../pages/ScoringCategoriesPage'
import SentimentAlertsPage from '../pages/SentimentAlertsPage'

// Route configuration
export const routes = [
  {
    path: '/',
    element: <DashboardPage />,
  },
  {
    path: '/dashboard',
    element: <DashboardPage />,
  },
  {
    path: '/calls',
    element: <VoipDashboardPage />,
  },
  {
    path: '/calls/mine',
    element: <MyCallsPage />,
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
    path: '/admin/company-info',
    element: <CompanyInfoPage />,
  },
  {
    path: '/admin/training-rules',
    element: <TrainingRulesPage />,
  },
  {
    path: '/admin/scoring',
    element: <ScoringCategoriesPage />,
  },
  {
    path: '/admin/sentiment-alerts',
    element: <SentimentAlertsPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]
