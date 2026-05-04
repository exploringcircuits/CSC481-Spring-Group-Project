import { useParams, useNavigate } from "react-router-dom";
import MyTeamCard from "../components/MyTeamCard";
import LeagueInfoCard from "../components/LeagueInfoCard";
import LMNote from "../components/LMNote";
import "../styles/Auth.css";
import "../styles/LeagueHome.css";

export default function LeagueHome() {
    const { leagueId: _leagueId } = useParams();
    const navigate = useNavigate();

    return (
        <div className="league-home-container">
            <div className="league-home-content">
                <h2 className="login-heading">League Home</h2>
                <div className="league-home-grid">
                    <MyTeamCard />
                    <LeagueInfoCard />
                    <LMNote />
                </div>
            </div>
            <button
                className="switch-league-button"
                onClick={() => navigate("/league-selection")}
            >
                Switch League
            </button>
        </div>
    );
}
