import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Home from "./pages/Home";
import JoinLeague from "./pages/JoinLeague";
import CreateLeague from "./pages/CreateLeague";
import LeagueSelection from "./pages/LeagueSelection";
import LeagueHome from "./pages/LeagueHome";
import Players from "./pages/Players";
import DraftSettings from "./pages/DraftSettings";
import LeagueMembers from "./pages/LeagueMembers";
import Draft from "./pages/Draft";
import MyTeam from "./pages/MyTeam";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
    return (
        <BrowserRouter>
            <Layout>
                <Routes>
                    {/* Public routes — no token required */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<SignUp />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/players" element={<Players />} />

                    {/* Protected routes — redirects to /login if no token */}
                    <Route path="/join-league" element={<ProtectedRoute><JoinLeague /></ProtectedRoute>} />
                    <Route path="/create-league" element={<ProtectedRoute><CreateLeague /></ProtectedRoute>} />
                    <Route path="/league-selection" element={<ProtectedRoute><LeagueSelection /></ProtectedRoute>} />
                    <Route path="/league/:leagueId" element={<ProtectedRoute><LeagueHome /></ProtectedRoute>} />
                    <Route path="/league/:leagueId/draft-settings" element={<ProtectedRoute><DraftSettings /></ProtectedRoute>} />
                    <Route path="/league/:leagueId/draft" element={<ProtectedRoute><Draft /></ProtectedRoute>} />
                    <Route path="/league/:leagueId/members" element={<ProtectedRoute><LeagueMembers /></ProtectedRoute>} />
                    <Route path="/league/:leagueId/my-team" element={<ProtectedRoute><MyTeam /></ProtectedRoute>} />
                    <Route path="/league/:leagueId/team/:teamId" element={<ProtectedRoute><MyTeam /></ProtectedRoute>} />

                    <Route path="/" element={<Navigate to="/login" />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    );
}

export default App;