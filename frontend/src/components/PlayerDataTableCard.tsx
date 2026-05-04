import { useState, useEffect } from "react";
import PlayerDataRow from "./PlayerDataRow";
import Tabs, { type Tab } from "./shared/Tabs";
import Toggle from "./shared/Toggle";
import Dropdown from "./shared/Dropdown";
import {
    fetchPlayers,
    type Player,
    type PlayerFilters as APIFilters,
} from "../services/api";
import { SEASON_OPTIONS } from "../constants/filterOptions";
import type { PlayerFilters } from "../pages/Players";
import "../styles/tables/PlayerDataTableCard.css";
import "../styles/tables/TableGrid.css";
import "../styles/tables/StatModeToggle.css";
import "../styles/tables/Pagination.css";

interface PlayerDataTableCardProps {
    filters: PlayerFilters;
}

export default function PlayerDataTableCard({
    filters,
}: PlayerDataTableCardProps) {
    const [activeTab, setActiveTab] = useState("stats");
    const [statMode, setStatMode] = useState("averages");
    const [selectedSeason, setSelectedSeason] = useState("2026 Season");
    const [compareEnabled, setCompareEnabled] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [players, setPlayers] = useState<Player[]>([]);
    const [totalPlayers, setTotalPlayers] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sortField, setSortField] = useState<string>("");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    const ROWS_PER_PAGE = 50;

    // Fetch players from API
    useEffect(() => {
        const loadPlayers = async () => {
            setLoading(true);
            setError(null);

            try {
                // Get current season option based on selectedSeason
                const seasonOption =
                    SEASON_OPTIONS.find(
                        (opt) => opt.label === selectedSeason,
                    ) || SEASON_OPTIONS[0];

                const apiFilters: APIFilters = {
                    position: filters.position,
                    team: filters.team,
                    status: filters.status,
                    health: filters.health,
                    search: filters.search,
                    season: seasonOption.value,
                    stat_period: seasonOption.period,
                    page: currentPage,
                };

                // Add sorting if set
                if (sortField) {
                    const direction = sortDirection === "desc" ? "-" : "";
                    apiFilters.ordering = `${direction}${sortField}`;
                }

                const response = await fetchPlayers(apiFilters);
                setPlayers(response.results);
                setTotalPlayers(response.count);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to fetch players",
                );
                console.error("Error fetching players:", err);
            } finally {
                setLoading(false);
            }
        };

        loadPlayers();
    }, [filters, currentPage, sortField, sortDirection, selectedSeason]);

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("desc");
        }
        setCurrentPage(1); // Reset to first page when sorting changes
    };

    const totalPages = Math.ceil(totalPlayers / ROWS_PER_PAGE);

    const tabList: Tab[] = [
        { id: "stats", label: "Stats" },
        { id: "trending", label: "Trending", disabled: true },
        { id: "schedule", label: "Schedule", disabled: true },
        { id: "news", label: "News", disabled: true },
    ];

    return (
        <div className="players-data-table-card">
            <div className="table-header">
                <Tabs
                    tabs={tabList}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
                <div className="header-right-section">
                    <Toggle
                        label="Compare Players"
                        checked={compareEnabled}
                        onChange={setCompareEnabled}
                    />
                    <span className="stats-label">Stats</span>
                    <Dropdown
                        label=""
                        options={SEASON_OPTIONS.map((opt) => opt.label)}
                        selected={selectedSeason}
                        onSelect={setSelectedSeason}
                    />
                    <div className="stat-mode-toggle">
                        <button
                            className={`toggle-btn ${
                                statMode === "totals" ? "active" : ""
                            }`}
                            onClick={() => setStatMode("totals")}
                        >
                            Totals
                        </button>
                        <button
                            className={`toggle-btn ${
                                statMode === "averages" ? "active" : ""
                            }`}
                            onClick={() => setStatMode("averages")}
                        >
                            Averages
                        </button>
                    </div>
                </div>
            </div>
            <div className="table-header-row">
                <div className="table-cell">PLAYERS</div>
                <div className="table-cell table-cell-span-2">STATUS</div>
                <div
                    className="table-cell table-cell-span-2"
                    style={{ opacity: 0.5 }}
                >
                    FEBRUARY 22
                </div>
                <div className="table-cell table-cell-span-12">STATS</div>
                <div className="table-cell table-cell-span-2">RESEARCH</div>
                <div className="table-cell table-cell-span-2">FANTASY PTS</div>
            </div>
            <div className="table-column-header-row">
                <div
                    className="table-cell"
                    onClick={() => handleSort("full_name")}
                    style={{ cursor: "pointer" }}
                >
                    PLAYER{" "}
                    {sortField === "full_name" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div className="table-cell">TYPE</div>
                <div className="table-cell">ACTION</div>
                <div className="table-cell" style={{ opacity: 0.5 }}>
                    OPP
                </div>
                <div className="table-cell" style={{ opacity: 0.5 }}>
                    STATUS
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("current_stats__min_avg")}
                    style={{ cursor: "pointer" }}
                >
                    MIN{" "}
                    {sortField === "current_stats__min_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("current_stats__fgm_avg")}
                    style={{ cursor: "pointer" }}
                >
                    FGM{" "}
                    {sortField === "current_stats__fgm_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("current_stats__fga_avg")}
                    style={{ cursor: "pointer" }}
                >
                    FGA{" "}
                    {sortField === "current_stats__fga_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("current_stats__ftm_avg")}
                    style={{ cursor: "pointer" }}
                >
                    FTM{" "}
                    {sortField === "current_stats__ftm_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("current_stats__fta_avg")}
                    style={{ cursor: "pointer" }}
                >
                    FTA{" "}
                    {sortField === "current_stats__fta_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("current_stats__fg3m_avg")}
                    style={{ cursor: "pointer" }}
                >
                    3PM{" "}
                    {sortField === "current_stats__fg3m_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("current_stats__reb_avg")}
                    style={{ cursor: "pointer" }}
                >
                    REB{" "}
                    {sortField === "current_stats__reb_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("current_stats__ast_avg")}
                    style={{ cursor: "pointer" }}
                >
                    AST{" "}
                    {sortField === "current_stats__ast_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("current_stats__stl_avg")}
                    style={{ cursor: "pointer" }}
                >
                    STL{" "}
                    {sortField === "current_stats__stl_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("current_stats__blk_avg")}
                    style={{ cursor: "pointer" }}
                >
                    BLK{" "}
                    {sortField === "current_stats__blk_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("current_stats__tov_avg")}
                    style={{ cursor: "pointer" }}
                >
                    TO{" "}
                    {sortField === "current_stats__tov_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("current_stats__pts_avg")}
                    style={{ cursor: "pointer" }}
                >
                    PTS{" "}
                    {sortField === "current_stats__pts_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("roster_percent")}
                    style={{ cursor: "pointer" }}
                >
                    %ROST{" "}
                    {sortField === "roster_percent" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() => handleSort("current_stats__plus_minus_avg")}
                    style={{ cursor: "pointer" }}
                >
                    +/-{" "}
                    {sortField === "current_stats__plus_minus_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() =>
                        handleSort("current_stats__fantasy_points_total")
                    }
                    style={{ cursor: "pointer" }}
                >
                    TOT{" "}
                    {sortField === "current_stats__fantasy_points_total" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
                <div
                    className="table-cell"
                    onClick={() =>
                        handleSort("current_stats__fantasy_points_avg")
                    }
                    style={{ cursor: "pointer" }}
                >
                    AVG{" "}
                    {sortField === "current_stats__fantasy_points_avg" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                </div>
            </div>
            {loading && (
                <div style={{ padding: "2rem", textAlign: "center" }}>
                    Loading players...
                </div>
            )}
            {error && (
                <div
                    style={{
                        padding: "2rem",
                        textAlign: "center",
                        color: "red",
                    }}
                >
                    Error: {error}
                </div>
            )}
            {!loading && !error && players.length === 0 && (
                <div style={{ padding: "2rem", textAlign: "center" }}>
                    No players found
                </div>
            )}
            {!loading &&
                !error &&
                players.map((player) => {
                    const stats = player.current_stats;
                    const isAvg = statMode === "averages";

                    return (
                        <PlayerDataRow
                            key={player.id}
                            playerId={player.player_id}
                            playerName={player.full_name}
                            team={player.team_abbreviation || "FA"}
                            position={player.position || "N/A"}
                            type={player.roster_status}
                            action=""
                            opp="--"
                            status={player.injury_status || ""}
                            min={
                                stats
                                    ? isAvg
                                        ? stats.min_avg.toFixed(1)
                                        : stats.min_total.toFixed(0)
                                    : "0"
                            }
                            fgm={
                                stats
                                    ? isAvg
                                        ? stats.fgm_avg.toFixed(1)
                                        : stats.fgm_total.toString()
                                    : "0"
                            }
                            fga={
                                stats
                                    ? isAvg
                                        ? stats.fga_avg.toFixed(1)
                                        : stats.fga_total.toString()
                                    : "0"
                            }
                            ftm={
                                stats
                                    ? isAvg
                                        ? stats.ftm_avg.toFixed(1)
                                        : stats.ftm_total.toString()
                                    : "0"
                            }
                            fta={
                                stats
                                    ? isAvg
                                        ? stats.fta_avg.toFixed(1)
                                        : stats.fta_total.toString()
                                    : "0"
                            }
                            threepm={
                                stats
                                    ? isAvg
                                        ? stats.fg3m_avg.toFixed(1)
                                        : stats.fg3m_total.toString()
                                    : "0"
                            }
                            reb={
                                stats
                                    ? isAvg
                                        ? stats.reb_avg.toFixed(1)
                                        : stats.reb_total.toString()
                                    : "0"
                            }
                            ast={
                                stats
                                    ? isAvg
                                        ? stats.ast_avg.toFixed(1)
                                        : stats.ast_total.toString()
                                    : "0"
                            }
                            stl={
                                stats
                                    ? isAvg
                                        ? stats.stl_avg.toFixed(1)
                                        : stats.stl_total.toString()
                                    : "0"
                            }
                            blk={
                                stats
                                    ? isAvg
                                        ? stats.blk_avg.toFixed(1)
                                        : stats.blk_total.toString()
                                    : "0"
                            }
                            to={
                                stats
                                    ? isAvg
                                        ? stats.tov_avg.toFixed(1)
                                        : stats.tov_total.toString()
                                    : "0"
                            }
                            pts={
                                stats
                                    ? isAvg
                                        ? stats.pts_avg.toFixed(1)
                                        : stats.pts_total.toString()
                                    : "0"
                            }
                            rostPercent={player.roster_percent.toFixed(1)}
                            plusMinus={
                                stats
                                    ? isAvg
                                        ? stats.plus_minus_avg.toFixed(1)
                                        : stats.plus_minus_total.toString()
                                    : "0"
                            }
                            tot={
                                stats
                                    ? stats.fantasy_points_total.toFixed(1)
                                    : "0"
                            }
                            avg={
                                stats
                                    ? stats.fantasy_points_avg.toFixed(1)
                                    : "0.0"
                            }
                        />
                    );
                })}
            <div className="pagination-area">
                <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                >
                    ← Previous
                </button>
                <span className="pagination-info">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                >
                    Next →
                </button>
            </div>
        </div>
    );
}
