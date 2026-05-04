import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PlayersFilterCard from "../components/PlayersFilterCard";
import PlayerDataTableCard from "../components/PlayerDataTableCard";
import "../styles/Players.css";

export interface PlayerFilters {
    position: string;
    team: string;
    status: string;
    health: string;
    search: string;
    statPeriod: string;
    season: string;
}

export default function Players() {
    const navigate = useNavigate();
    const [filters, setFilters] = useState<PlayerFilters>({
        position: "All Players",
        team: "All",
        status: "All",
        health: "All",
        search: "",
        statPeriod: "season",
        season: "2025-26",
    });

    const handleFilterChange = (newFilters: Partial<PlayerFilters>) => {
        setFilters((prev) => ({ ...prev, ...newFilters }));
    };

    return (
        <div className="players-page">
            <h2 className="login-heading">Players</h2>
            <PlayersFilterCard onFilterChange={handleFilterChange} />
            <PlayerDataTableCard filters={filters} />
            <button
                className="switch-league-button"
                onClick={() => navigate("/league-selection")}
            >
                Switch League
            </button>
        </div>
    );
}
