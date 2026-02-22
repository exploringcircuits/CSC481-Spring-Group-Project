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

function App() {
    return (
        <BrowserRouter>
            <Layout>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<SignUp />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/join-league" element={<JoinLeague />} />
                    <Route path="/create-league" element={<CreateLeague />} />
                    <Route
                        path="/league-selection"
                        element={<LeagueSelection />}
                    />
                    <Route path="/league/:leagueId" element={<LeagueHome />} />
                    <Route path="/players" element={<Players />} />
                    <Route path="/" element={<Navigate to="/login" />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    );
}

export default App;
