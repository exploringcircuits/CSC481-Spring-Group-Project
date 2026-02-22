import { useState, useEffect } from "react";
import {
    POSITIONS,
    FILTER_OPTIONS,
    HEALTH_OPTIONS,
    WATCH_LIST_OPTIONS,
    NBA_TEAMS,
} from "../constants/filterOptions";
import Dropdown from "./shared/Dropdown";
import StatQualifier from "./shared/StatQualifier";
import Calendar from "./shared/Calendar";
import "../styles/filters/PlayersFilterCard.css";
import "../styles/filters/PositionFilter.css";
import "../styles/filters/ResetButton.css";

interface PlayersFilterCardProps {
    onFilterChange: (filters: {
        position?: string;
        team?: string;
        status?: string;
        health?: string;
        search?: string;
    }) => void;
}

export default function PlayersFilterCard({
    onFilterChange,
}: PlayersFilterCardProps) {
    const [selectedPosition, setSelectedPosition] = useState("All Players");
    const [selectedFilter, setSelectedFilter] = useState("All");
    const [selectedProTeam, setSelectedProTeam] = useState("All");
    const [selectedHealth, setSelectedHealth] = useState("All");
    const [selectedWatchList, setSelectedWatchList] = useState("All");
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [selectedStatQualifier, setSelectedStatQualifier] = useState("Off");
    const [statQualifierValue, setStatQualifierValue] = useState(0.0);
    const [searchQuery, setSearchQuery] = useState("");

    // Notify parent of filter changes
    useEffect(() => {
        onFilterChange({
            position: selectedPosition,
            team: selectedProTeam,
            status: selectedFilter,
            search: searchQuery,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPosition, selectedProTeam, selectedFilter, searchQuery]);

    const handleResetAll = () => {
        setSelectedPosition("All Players");
        setSelectedFilter("All");
        setSelectedProTeam("All");
        setSelectedHealth("All");
        setSelectedWatchList("All");
        setSelectedDate("");
        setSelectedStatQualifier("Off");
        setStatQualifierValue(0.0);
        setSearchQuery("");
    };

    return (
        <div className="players-filter-card">
            <div className="players-section-header">
                <div className="players-header-left">
                    {/* Title Row */}
                    <div className="players-title-row">
                        <h3 className="players-section-title">Free Agents</h3>
                        <span className="players-league-name">League Name</span>
                    </div>

                    {/* Position Filter Buttons */}
                    <div className="players-position-row">
                        <span className="players-info-label">Position: </span>
                        <button
                            className={`players-position-button ${
                                selectedPosition === "All Players"
                                    ? "active"
                                    : ""
                            }`}
                            onClick={() => setSelectedPosition("All Players")}
                        >
                            All Players
                        </button>
                        {POSITIONS.map((pos) => (
                            <div
                                key={pos}
                                className="position-button-with-divider"
                            >
                                <span className="position-divider">|</span>
                                <button
                                    className={`players-position-button ${
                                        selectedPosition === pos ? "active" : ""
                                    }`}
                                    onClick={() => setSelectedPosition(pos)}
                                >
                                    {pos}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Filters Container */}
                    <div className="players-filters-container">
                        {/* Left Column: Filter & Stat Qualifier */}
                        <div className="filter-stat-qualifier-column">
                            <Dropdown
                                label="Filter"
                                options={FILTER_OPTIONS}
                                selected={selectedFilter}
                                onSelect={setSelectedFilter}
                            />
                            {/* Stat Qualifier (Disabled - Coming Soon) */}
                            <StatQualifier
                                selectedStat={selectedStatQualifier}
                                selectedValue={statQualifierValue}
                                onStatChange={setSelectedStatQualifier}
                                onValueChange={setStatQualifierValue}
                                disabled={true}
                            />
                        </div>

                        {/* Pro Team Dropdown */}
                        <Dropdown
                            label="Pro Team"
                            options={NBA_TEAMS}
                            selected={selectedProTeam}
                            onSelect={setSelectedProTeam}
                        />

                        {/* Health Dropdown (Disabled - Coming Soon) */}
                        <Dropdown
                            label="Health"
                            options={HEALTH_OPTIONS}
                            selected={selectedHealth}
                            onSelect={setSelectedHealth}
                            disabled={true}
                            title="Health filter coming soon"
                        />

                        {/* Watch List Dropdown (Disabled - Coming Soon) */}
                        <Dropdown
                            label="Watch List"
                            options={WATCH_LIST_OPTIONS}
                            selected={selectedWatchList}
                            onSelect={setSelectedWatchList}
                            disabled={true}
                            title="Watch List feature coming soon"
                        />

                        {/* Calendar for Playing Filter (Disabled - Coming Soon) */}
                        <div
                            className="calendar-icon-wrapper"
                            style={{ opacity: 0.5, pointerEvents: "none" }}
                            title="Playing filter coming soon"
                        >
                            <Calendar
                                selectedDate={selectedDate}
                                onDateSelect={setSelectedDate}
                            />
                        </div>
                    </div>
                </div>

                {/* Search Input */}
                <div className="player-search-container">
                    <svg
                        className="player-search-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path d="M10.5 1a9.5 9.5 0 0 1 7.596 15.236l8.734 8.734a1.5 1.5 0 1 1-2.121 2.121l-8.734-8.734A9.5 9.5 0 1 1 10.5 1zm0 3a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" />
                    </svg>
                    <input
                        type="text"
                        className="player-search-input"
                        placeholder="Player Name"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Reset Button */}
                <div className="players-card-footer">
                    <button
                        className="reset-all-button"
                        onClick={handleResetAll}
                    >
                        Reset All
                    </button>
                </div>
            </div>
        </div>
    );
}
