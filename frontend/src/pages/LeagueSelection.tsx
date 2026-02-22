import { useNavigate } from "react-router-dom";
import LeagueCard from "../components/LeagueCard";
import "../styles/Auth.css";
import "../styles/LeagueSelection.css";

export default function LeagueSelection() {
    const navigate = useNavigate();

    return (
        <div className="league-selection-page">
            <h2 className="login-heading">League Selection</h2>
            <div className="leagues-container">
                <LeagueCard
                    leagueName="League Name"
                    teamName="Team Name"
                    teamCount={4}
                    scoringType="H2H Points"
                    leagueId="1"
                    onClick={() => navigate("/league/1")}
                />
                <button
                    className="add-league-button"
                    onClick={() => navigate("/home")}
                >
                    <svg
                        className="add-league-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M12 5V19M5 12H19"
                            stroke="black"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}
