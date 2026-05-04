import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchLeague, type LeagueDetails } from "../services/api";
import "../styles/LeagueHome.css";

import "../styles/LeagueInfoCard.css";

export default function LeagueInfoCard() {
    const navigate = useNavigate();
    const { leagueId: paramsLeagueId } = useParams();
    const leagueId = paramsLeagueId ? parseInt(paramsLeagueId, 10) : 0;
    const [league, setLeague] = useState<LeagueDetails | null>(null);
    const [nowMs, setNowMs] = useState(Date.now());

    useEffect(() => {
        if (!leagueId) {
            return;
        }

        const loadLeague = async () => {
            try {
                const result = await fetchLeague(leagueId);
                setLeague(result);
            } catch (error) {
                console.error(error);
            }
        };

        loadLeague();
    }, [leagueId]);

    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleEditDraftSettings = () => {
        if (leagueId) {
            navigate(`/league/${leagueId}/draft-settings`);
        }
    };

    const handleJoinDraft = () => {
        if (leagueId) {
            navigate(`/league/${leagueId}/draft`);
        }
    };

    const handleInviteUsers = () => {
        if (leagueId) {
            navigate(`/league/${leagueId}/members`);
        }
    };

    const draftSummary = useMemo(() => {
        const draft = league?.draft;
        const isFull = (league?.members?.length ?? 0) >= (league?.max_players ?? 4);
        const scheduledDate = draft?.scheduled_date;
        const isConfigured = Boolean(scheduledDate);

        if (!isConfigured) {
            return {
                headline: isFull
                    ? "Your league is full and draft settings are ready to configure."
                    : "Your league is not full yet and your draft has not been scheduled!",
                countdown: "No draft date selected",
                type: draft?.draft_type ?? "SNAKE",
                order: draft?.draft_order ?? "RANDOM",
                timePerPick: draft?.time_per_pick ?? 90,
                scheduledLocal: "Not scheduled",
                isConfigured: false,
                isFull,
            };
        }

        const targetMs = new Date(scheduledDate as string).getTime();
        const diffMs = targetMs - nowMs;
        const clamped = Math.max(diffMs, 0);
        const totalSeconds = Math.floor(clamped / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return {
            headline: diffMs > 0
                ? "Draft is scheduled. Review settings below."
                : "Draft start time has arrived.",
            countdown: `${days}d ${hours}h ${minutes}m ${seconds}s`,
            type: draft?.draft_type ?? "SNAKE",
            order: draft?.draft_order ?? "RANDOM",
            timePerPick: draft?.time_per_pick ?? 90,
            scheduledLocal: new Date(scheduledDate as string).toLocaleString(),
            isConfigured: true,
            isJoinWindow: diffMs <= 5 * 60 * 1000,
            isFull,
        };
    }, [league, nowMs]);

    const draftButtonLabel = !draftSummary.isConfigured
        ? "Schedule Draft"
        : draftSummary.isJoinWindow
            ? "Join Draft"
            : "Edit Draft Settings";

    const draftButtonAction = draftSummary.isConfigured && draftSummary.isJoinWindow
        ? handleJoinDraft
        : handleEditDraftSettings;

    const isScheduleDisabled = !draftSummary.isConfigured && !draftSummary.isFull;

    return (
        <section className="league-card league-card--wide">
            <div className="league-info-container">
                <div className="league-info-left">
                    <div className="league-name">{league?.name ?? "League Name"}</div>
                    <div className="league-info-links">
                        <a href="#" className="league-info-link" onClick={(e) => { e.preventDefault(); handleInviteUsers(); }}>
                            Members
                        </a>
                        <a href="#" className="league-info-link">
                            Rosters
                        </a>
                        <a href="#" className="league-info-link">
                            Settings
                        </a>
                    </div>
                </div>
                <div className="league-info-right">
                    <div className="league-info-detail">
                        <span className="league-info-label">Creator:</span>
                        <span>{league?.commissioner_email ?? "Username"}</span>
                    </div>
                    <div className="league-info-detail">
                        <span className="league-info-label">Format:</span>
                        <span>League Manager</span>
                    </div>
                    <div className="league-info-detail">
                        <span className="league-info-label">Scoring:</span>
                        <span>H2H Points</span>
                    </div>
                    <div className="league-info-detail">
                        <span className="league-info-label">Teams:</span>
                        <span>{league?.members?.length ?? 0}/{league?.max_players ?? 4}</span>
                    </div>
                </div>
            </div>
            <div className="league-info-warning league-info-warning--status">
                {draftSummary.headline}
            </div>
            {draftSummary.isConfigured && (
                <div className="league-draft-meta">
                    <div className="league-draft-meta-item">
                        <span className="league-info-label">Draft Type:</span>
                        <span>{draftSummary.type}</span>
                    </div>
                    <div className="league-draft-meta-item">
                        <span className="league-info-label">Draft Order:</span>
                        <span>{draftSummary.order === "RANDOM" ? "Random" : "Custom"}</span>
                    </div>
                    <div className="league-draft-meta-item">
                        <span className="league-info-label">Time Per Pick:</span>
                        <span>{draftSummary.timePerPick} seconds</span>
                    </div>
                    <div className="league-draft-meta-item">
                        <span className="league-info-label">Scheduled:</span>
                        <span>{draftSummary.scheduledLocal}</span>
                    </div>
                    <div className="league-draft-meta-item league-draft-countdown">
                        <span className="league-info-label">Countdown:</span>
                        <span>{draftSummary.countdown}</span>
                    </div>
                </div>
            )}
            <div className="league-info-buttons">
                <button className="league-info-button" onClick={handleInviteUsers}>Invite Users</button>
                <button className="league-info-button" onClick={draftButtonAction} disabled={isScheduleDisabled}>
                    {draftButtonLabel}
                </button>
            </div>
        </section>
    );
}
