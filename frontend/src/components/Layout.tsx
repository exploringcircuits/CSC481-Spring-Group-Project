import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../styles/Layout.css";

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();

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

    return (
        <div className="app-wrapper">
            <div className="header">
                <div className="header-left">
                    <h1 className="title">Fantasy Basketball</h1>
                    {isLeaguePage && (
                        <>
                            <span className="nav-delimiter">|</span>
                            <nav className="nav-menu">
                                <button className="nav-item">My Team</button>
                                <div className="nav-item-group">
                                    <button
                                        className={`nav-item ${
                                            location.pathname.startsWith(
                                                "/league/",
                                            )
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
                                        <button type="button">Members</button>
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
                                        <button
                                            type="button"
                                            className="opposing-item"
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
                                                    Gotham Grizzlies (GGR)
                                                </span>
                                                <span className="opposing-user">
                                                    Bot Alpha
                                                </span>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            className="opposing-item"
                                        >
                                            <svg
                                                className="opposing-logo"
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
                                            >
                                                <rect
                                                    x="4"
                                                    y="4"
                                                    width="16"
                                                    height="16"
                                                />
                                            </svg>
                                            <div className="opposing-text">
                                                <span className="opposing-name">
                                                    Harbor Hawks (HHK)
                                                </span>
                                                <span className="opposing-user">
                                                    Bot Bravo
                                                </span>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            className="opposing-item"
                                        >
                                            <svg
                                                className="opposing-logo"
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
                                            >
                                                <polygon points="12,4 20,20 4,20" />
                                            </svg>
                                            <div className="opposing-text">
                                                <span className="opposing-name">
                                                    Metro Meteors (MMT)
                                                </span>
                                                <span className="opposing-user">
                                                    Bot Charlie
                                                </span>
                                            </div>
                                        </button>
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
            <footer className="footer">
                <p>Copyright © 2026 Fantasy Fanatics. All rights reserved.</p>
            </footer>
        </div>
    );
}
