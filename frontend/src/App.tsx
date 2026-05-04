import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"

import { AuthProvider } from "@/contexts/AuthContext"
import { Layout } from "@/components/layout/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"

import { LandingPage } from "@/pages/LandingPage"
import { LoginPage } from "@/pages/LoginPage"
import { SignUpPage } from "@/pages/SignUpPage"
import { MockDraftPage } from "@/pages/MockDraftPage"
import { LeagueSelectionPage } from "@/pages/LeagueSelectionPage"
import { LeagueHomePage } from "@/pages/LeagueHomePage"
import { LeagueMembersPage } from "@/pages/LeagueMembersPage"
import { DraftPage } from "@/pages/DraftPage"
import { DraftSetupPage } from "@/pages/DraftSetupPage"
import { MyTeamPage } from "@/pages/MyTeamPage"
import { StandingsPage } from "@/pages/StandingsPage"
import { BracketPage } from "@/pages/BracketPage"
import { SchedulePage } from "@/pages/SchedulePage"
import { TradesPage } from "@/pages/TradesPage"
import { TransactionsPage } from "@/pages/TransactionsPage"
import { PlayersPage } from "@/pages/PlayersPage"
import { PlayerDetailPage } from "@/pages/PlayerDetailPage"
import { AdminPanelPage } from "@/pages/AdminPanelPage"
import { SettingsPage } from "@/pages/SettingsPage"

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/mock-draft" element={<MockDraftPage />} />

            {/* Authenticated */}
            <Route element={<ProtectedRoute />}>
              <Route path="/leagues" element={<LeagueSelectionPage />} />
              <Route path="/leagues/:leagueId" element={<LeagueHomePage />} />
              <Route path="/leagues/:leagueId/members" element={<LeagueMembersPage />} />
              <Route path="/leagues/:leagueId/draft" element={<DraftPage />} />
              <Route path="/leagues/:leagueId/draft/setup" element={<DraftSetupPage />} />
              <Route path="/leagues/:leagueId/team/:teamId" element={<MyTeamPage />} />
              <Route path="/leagues/:leagueId/team" element={<MyTeamPage />} />
              <Route path="/leagues/:leagueId/standings" element={<StandingsPage />} />
              <Route path="/leagues/:leagueId/schedule" element={<SchedulePage />} />
              <Route path="/leagues/:leagueId/bracket" element={<BracketPage />} />
              <Route path="/leagues/:leagueId/trades" element={<TradesPage />} />
              <Route path="/leagues/:leagueId/players" element={<PlayersPage />} />
              <Route path="/leagues/:leagueId/players/:playerId" element={<PlayerDetailPage />} />
              <Route path="/leagues/:leagueId/transactions" element={<TransactionsPage />} />
              <Route path="/admin" element={<AdminPanelPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  )
}

export default App
