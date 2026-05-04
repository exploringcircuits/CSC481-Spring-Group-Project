import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createExampleLeague, fetchLeague, fillLeagueWithBots, resetDraftSettings } from "../services/api";
import "../styles/Layout.css";

interface LayoutProps {
    children: ReactNode;
}

interface OpposingTeamNavItem {
    id: number;
    teamName: string;
    managerName: string;
}

export default function Layout({ children }: LayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
    const [isDraftPaused, setIsDraftPaused] = useState(false);
    const [opposingTeams, setOpposingTeams] = useState<OpposingTeamNavItem[]>([]);
    const [slowAutopick, setSlowAutopick] = useState(
        () => localStorage.getItem("slowAutopick") === "true",
    );

    // Extract leagueId from pathname manually
    const pathMatch = location.pathname.match(/^\/league\/([^/]+)/);
    const urlLeagueId = pathMatch ? pathMatch[1] : null;

    // Use localStorage to persist leagueId
    useEffect(() => {
        if (urlLeagueId) {
            localStorage.setItem("currentLeagueId", urlLeagueId);
        }
    }, [urlLeagueId]);

    const leagueId = urlLeagueId || localStorage.getItem("currentLeagueId");

    const isAuthPage =
        location.pathname === "/login" || location.pathname === "/signup";
    const isLeaguePage =
        location.pathname.startsWith("/league/") ||
        location.pathname === "/players";

    const getDraftPauseKey = () => `draftPaused:${leagueId ?? "global"}`;

    useEffect(() => {
        const key = getDraftPauseKey();
        setIsDraftPaused(localStorage.getItem(key) === "true");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leagueId]);

    useEffect(() => {
        const loadOpposingTeams = async () => {
            if (!leagueId) {
                setOpposingTeams([]);
                return;
            }

            const parsedLeagueId = parseInt(leagueId, 10);
            if (Number.isNaN(parsedLeagueId)) {
                setOpposingTeams([]);
                return;
            }

            try {
                const data = await fetchLeague(parsedLeagueId);
                const currentUserEmail = (localStorage.getItem("userEmail") ?? "").toLowerCase();
                const members = (data.members ?? []).slice().sort((a, b) => a.slot - b.slot);
                const ownMember = currentUserEmail
                    ? members.find((member) => member.email.toLowerCase() === currentUserEmail)
                    : null;
                const ownMemberId = ownMember?.id ?? members[0]?.id ?? null;

                const items = members
                    .filter((member) => ownMemberId == null || member.id !== ownMemberId)
                    .map((member) => {
                        const team = (data.teams ?? []).find((t) => t.member?.id === member.id);
                        return {
                            id: member.id,
                            teamName: team?.name ?? member.display_name,
                            managerName: member.display_name,
                        };
                    });

                setOpposingTeams(items);
            } catch {
                setOpposingTeams([]);
            }
        };

        if (isLeaguePage) {
            loadOpposingTeams();
        }
    }, [leagueId, isLeaguePage]);

    const handleResetDraftSettings = async () => {
        if (!leagueId) {
            return;
        }

        const parsedLeagueId = parseInt(leagueId, 10);
        if (Number.isNaN(parsedLeagueId)) {
            return;
        }

        try {
            await resetDraftSettings(parsedLeagueId);
            setIsAdminMenuOpen(false);
            navigate(`/league/${parsedLeagueId}`);
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreateExampleLeague = async () => {
        try {
            const league = await createExampleLeague();
            localStorage.setItem("currentLeagueId", String(league.id));
            setIsAdminMenuOpen(false);
            navigate("/league-selection");
        } catch (error) {
            console.error(error);
        }
    };

    const handleFillBots = async () => {
        if (!leagueId) {
            return;
        }

        const parsedLeagueId = parseInt(leagueId, 10);
        if (Number.isNaN(parsedLeagueId)) {
            return;
        }

        try {
            await fillLeagueWithBots(parsedLeagueId);
            setIsAdminMenuOpen(false);
            navigate(`/league/${parsedLeagueId}/members?refresh=${Date.now()}`);
        } catch (error) {
            console.error(error);
        }
    };

    const handleToggleDraftPause = () => {
        const key = getDraftPauseKey();
        const nextPausedValue = !isDraftPaused;
        localStorage.setItem(key, String(nextPausedValue));
        setIsDraftPaused(nextPausedValue);
        window.dispatchEvent(new CustomEvent("draft-pause-changed", {
            detail: { paused: nextPausedValue, key },
        }));
        setIsAdminMenuOpen(false);
    };

    const handleToggleSlowAutopick = () => {
        const next = !slowAutopick;
        localStorage.setItem("slowAutopick", String(next));
        setSlowAutopick(next);
        window.dispatchEvent(new CustomEvent("slow-autopick-changed", {
            detail: { slow: next },
        }));
    };

    return (
        <div className="app-wrapper">
            <div className="header">
                <div className="header-left">
                    <h1 className="title">Fantasy Basketball</h1>
                    {isLeaguePage && (
                        <>
                            <span className="nav-delimiter">|</span>
                            <nav className="nav-menu">
                                <button
                                    className={`nav-item ${location.pathname.includes("/my-team") ? "active" : ""}`}
                                    onClick={() => {
                                        const id = localStorage.getItem("currentLeagueId");
                                        if (id) {
                                            navigate(`/league/${id}/my-team`);
                                        }
                                    }}
                                >
                                    My Team
                                </button>
                                <div className="nav-item-group">
                                    <button
                                        className={`nav-item ${
                                            location.pathname.startsWith("/league/")
                                                && !location.pathname.includes("/my-team")
                                                ? "active"
                                                : ""
                                        }`}
                                        onClick={() => {
                                            const id =
                                                localStorage.getItem(
                                                    "currentLeagueId",
                                                );
                                            if (id) {
                                                navigate(`/league/${id}`);
                                            }
                                        }}
                                    >
                                        League
                                        <svg
                                            className="nav-dropdown-icon"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                        >
                                            <path
                                                d="M7 10L12 15L17 10"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </button>
                                    <div className="nav-dropdown">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const id =
                                                    localStorage.getItem(
                                                        "currentLeagueId",
                                                    );
                                                if (id) {
                                                    navigate(`/league/${id}`);
                                                }
                                            }}
                                        >
                                            League Home
                                        </button>
                                        <button type="button">
                                            Message Board
                                        </button>
                                        <button type="button">Settings</button>
                                        <button type="button">
                                            Transaction Counter
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const id =
                                                    localStorage.getItem(
                                                        "currentLeagueId",
                                                    );
                                                if (id) {
                                                    navigate(
                                                        `/league/${id}/members`,
                                                    );
                                                }
                                            }}
                                        >
                                            Members
                                        </button>
                                        <button type="button">
                                            Draft Recap
                                        </button>
                                        <button type="button">Rosters</button>
                                        <button type="button">
                                            Email League
                                        </button>
                                        <button type="button">Schedule</button>
                                        <button type="button">
                                            Recent Activity
                                        </button>
                                    </div>
                                </div>
                                <div className="nav-item-group">
                                    <button
                                        className={`nav-item ${
                                            location.pathname === "/players"
                                                ? "active"
                                                : ""
                                        }`}
                                        onClick={() =>
                                            navigate("/players", {
                                                state: { leagueId },
                                            })
                                        }
                                    >
                                        Players
                                        <svg
                                            className="dropdown-icon"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                        >
                                            <path
                                                d="M7 10L12 15L17 10"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </button>
                                    <div className="nav-dropdown">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                navigate("/players", {
                                                    state: { leagueId },
                                                })
                                            }
                                        >
                                            Add Players
                                        </button>
                                        <button type="button">
                                            Player News
                                        </button>
                                        <button type="button">
                                            Watch List
                                        </button>
                                        <button type="button">
                                            Projections
                                        </button>
                                        <button type="button">
                                            Daily Leaders
                                        </button>
                                        <button type="button">
                                            Waiver Order
                                        </button>
                                        <button type="button">
                                            Live Draft Trends
                                        </button>
                                        <button type="button">
                                            Waiver Report
                                        </button>
                                        <button type="button">
                                            Added / Dropped
                                        </button>
                                        <button type="button">
                                            Undropppables
                                        </button>
                                    </div>
                                </div>
                                <button className="nav-item">
                                    Fantasy Cast
                                </button>
                                <button className="nav-item">Scoreboard</button>
                                <button className="nav-item">Standings</button>
                                <div className="nav-item-group">
                                    <button className="nav-item">
                                        Opposing Teams
                                        <svg
                                            className="dropdown-icon"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                        >
                                            <path
                                                d="M7 10L12 15L17 10"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </button>
                                    <div className="nav-dropdown opposing-dropdown">
                                        {opposingTeams.length === 0 ? (
                                            <button type="button" className="opposing-item" disabled>
                                                <div className="opposing-text">
                                                    <span className="opposing-name">No opposing teams</span>
                                                </div>
                                            </button>
                                        ) : (
                                            opposingTeams.map((team) => (
                                                <button
                                                    key={team.id}
                                                    type="button"
                                                    className="opposing-item"
                                                    onClick={() => {
                                                        const id = localStorage.getItem("currentLeagueId");
                                                        if (id) {
                                                            navigate(`/league/${id}/team/${team.id}`);
                                                        }
                                                    }}
                                                >
                                                    <svg
                                                        className="opposing-logo"
                                                        viewBox="0 0 24 24"
                                                        aria-hidden="true"
                                                    >
                                                        <circle cx="12" cy="12" r="9" />
                                                    </svg>
                                                    <div className="opposing-text">
                                                        <span className="opposing-name">
                                                            {team.teamName}
                                                        </span>
                                                        <span className="opposing-user">
                                                            {team.managerName}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                                <button className="nav-item">LM Tools</button>
                            </nav>
                        </>
                    )}
                </div>
                {!isAuthPage && (
                    <Link to="/login" className="sign-out">
                        Sign Out
                    </Link>
                )}
            </div>
            <div className="main-content">{children}</div>

            <div className="global-admin-tools-container">
                {isAdminMenuOpen && (
                    <div className="global-admin-tools-menu">
                        <button type="button" onClick={handleCreateExampleLeague}>
                            Create Example League
                        </button>
                        <button type="button" onClick={handleFillBots} disabled={!leagueId}>
                            Fill Empty Slots With Bots
                        </button>
                        <button
                            type="button"
                            onClick={handleResetDraftSettings}
                            disabled={!leagueId}
                        >
                            Reset Draft Settings
                        </button>
                        <button type="button" onClick={handleToggleDraftPause}>
                            {isDraftPaused ? "Resume Draft" : "Pause Draft"}
                        </button>
                        <button type="button" onClick={handleToggleSlowAutopick}>
                            {slowAutopick ? "Autopick: 10s Delay" : "Autopick: Instant"}
                        </button>
                    </div>
                )}
                <button
                    type="button"
                    className="global-admin-tools-button"
                    onClick={() => setIsAdminMenuOpen((open) => !open)}
                >
                    Admin
                </button>
            </div>

            <footer className="footer">
                <p>Copyright © 2026 Fantasy Fanatics. All rights reserved.</p>
            </footer>
        </div>
    );
}
