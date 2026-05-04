import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"

import { AuthProvider } from "@/contexts/AuthContext"
import { Layout } from "@/components/layout/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"

import { LoginPage } from "@/pages/LoginPage"
import { SignUpPage } from "@/pages/SignUpPage"
import { LeagueSelectionPage } from "@/pages/LeagueSelectionPage"
import { LeagueHomePage } from "@/pages/LeagueHomePage"
import { DraftPage } from "@/pages/DraftPage"
import { MyTeamPage } from "@/pages/MyTeamPage"
import { StandingsPage } from "@/pages/StandingsPage"
import { BracketPage } from "@/pages/BracketPage"
import { TradesPage } from "@/pages/TradesPage"
import { PlayersPage } from "@/pages/PlayersPage"
import { AdminPanelPage } from "@/pages/AdminPanelPage"

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/leagues" element={<LeagueSelectionPage />} />
              <Route path="/leagues/:leagueId" element={<LeagueHomePage />} />
              <Route path="/leagues/:leagueId/draft" element={<DraftPage />} />
              <Route path="/leagues/:leagueId/team/:teamId" element={<MyTeamPage />} />
              <Route path="/leagues/:leagueId/team" element={<MyTeamPage />} />
              <Route path="/leagues/:leagueId/standings" element={<StandingsPage />} />
              <Route path="/leagues/:leagueId/bracket" element={<BracketPage />} />
              <Route path="/leagues/:leagueId/trades" element={<TradesPage />} />
              <Route path="/leagues/:leagueId/players" element={<PlayersPage />} />
              <Route path="/admin" element={<AdminPanelPage />} />
            </Route>

            <Route path="/" element={<Navigate to="/leagues" replace />} />
            <Route path="*" element={<Navigate to="/leagues" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  )
}

export default App
