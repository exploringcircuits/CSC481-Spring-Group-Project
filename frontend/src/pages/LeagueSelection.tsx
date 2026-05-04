import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LeagueCard from "../components/LeagueCard";
import { createExampleLeague, fetchLeagues, type LeagueListItem } from "../services/api";
import "../styles/Auth.css";
import "../styles/LeagueSelection.css";

export default function LeagueSelection() {
    const navigate = useNavigate();
    const [leagues, setLeagues] = useState<LeagueListItem[]>([]);

    useEffect(() => {
        const loadLeagues = async () => {
            try {
                await createExampleLeague();
                const result = await fetchLeagues();
                setLeagues(result);
            } catch (error) {
                console.error(error);
                setLeagues([]);
            }
        };

        loadLeagues();
    }, []);

    return (
        <div className="league-selection-page">
            <h2 className="login-heading">League Selection</h2>
            <div className="leagues-container">
                {leagues.map((league) => (
                    <LeagueCard
                        key={league.id}
                        leagueName={league.name}
                        teamName="My Team"
                        teamCount={league.max_players}
                        scoringType="H2H Points"
                        leagueId={String(league.id)}
                        onClick={() => navigate(`/league/${league.id}`)}
                    />
                ))}

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
