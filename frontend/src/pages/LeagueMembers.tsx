import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchLeague, type LeagueDetails, type LeagueMember, type LeagueTeam } from "../services/api";
import "../styles/LeagueMembers.css";

interface MemberRow {
    slot: number;
    abbreviation: string;
    teamName: string;
    member: LeagueMember | null;
}

const abbreviationForSlot = (slot: number): string => `TM${slot}`;

const defaultTeamName = (slot: number): string => `Team ${slot}`;

const resolveTeamBySlot = (teams: LeagueTeam[], slot: number): LeagueTeam | null => {
    return teams.find((team) => team.member?.slot === slot) ?? null;
};

export default function LeagueMembers() {
    const { leagueId: paramsLeagueId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const leagueId = paramsLeagueId ? parseInt(paramsLeagueId, 10) : 0;

    const [league, setLeague] = useState<LeagueDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [inviteTarget, setInviteTarget] = useState<"new-or-changed" | "not-joined">("new-or-changed");
    const [sendCopy, setSendCopy] = useState(false);
    const [addCustomMessage, setAddCustomMessage] = useState(false);

    useEffect(() => {
        const loadLeague = async () => {
            if (!leagueId) {
                setLoadError("Missing league id.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const result = await fetchLeague(leagueId);
                setLeague(result);
                setLoadError(null);
            } catch (loadError) {
                setLoadError("Unable to load league members.");
                setLeague(null);
                console.error(loadError);
            } finally {
                setLoading(false);
            }
        };

        loadLeague();
    }, [leagueId, location.search]);

    const inviteLink = useMemo(() => {
        if (!league) {
            return "";
        }
        return `${window.location.origin}/join-league?leagueId=${league.id}`;
    }, [league]);

    const memberRows = useMemo((): MemberRow[] => {
        if (!league) {
            return [];
        }

        const rows: MemberRow[] = [];
        for (let slot = 1; slot <= league.max_players; slot += 1) {
            const member = league.members.find((m) => m.slot === slot) ?? null;
            const team = resolveTeamBySlot(league.teams, slot);

            rows.push({
                slot,
                abbreviation: abbreviationForSlot(slot),
                teamName: team?.name ?? defaultTeamName(slot),
                member,
            });
        }

        return rows;
    }, [league]);

    const displayRows = useMemo(() => {
        const totalSlots = Math.max(league?.max_players ?? 0, 0);
        const baseRows = memberRows.length > 0 ? memberRows : [];

        const rows: MemberRow[] = [];
        for (let slot = 1; slot <= totalSlots; slot += 1) {
            const existingRow = baseRows.find((row) => row.slot === slot);
            rows.push(
                existingRow ?? {
                    slot,
                    abbreviation: abbreviationForSlot(slot),
                    teamName: defaultTeamName(slot),
                    member: null,
                },
            );
        }

        return rows;
    }, [league?.max_players, memberRows]);

    const handleCopyLink = async () => {
        if (!inviteLink) {
            return;
        }

        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (copyError) {
            console.error(copyError);
        }
    };

    if (loading) {
        return (
            <div className="league-members-page">
                <h2 className="league-members-heading">League Members</h2>
                <div className="league-members-card">Loading members...</div>
            </div>
        );
    }

    return (
        <div className="league-members-page">
            <h2 className="league-members-heading">League Members</h2>

            <div className="league-members-card">
                <div className="league-members-header">
                    <div className="league-members-title-row">
                        <h3>{league?.name ?? "League"}</h3>
                    </div>
                    <button className="members-outline-button" type="button" disabled>
                        Change Number Of Teams
                    </button>
                </div>

                <div className="invite-link-row">
                    <label htmlFor="invite-link">Invite Link</label>
                    <input id="invite-link" type="text" value={inviteLink} readOnly />
                    <button className="link-button" type="button" onClick={handleCopyLink}>
                        {copied ? "Copied" : "Copy Link"}
                    </button>
                </div>

                <table className="members-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>ABBRV</th>
                            <th>TEAM NAME</th>
                            <th>MANAGER NAME</th>
                            <th>EMAIL</th>
                            <th>STATUS</th>
                            <th>ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((row) => (
                            <tr key={row.slot}>
                                <td>{row.slot}</td>
                                <td>{row.abbreviation}</td>
                                <td>{row.teamName}</td>
                                <td>{row.member?.display_name ?? ""}</td>
                                <td>
                                    {row.member ? (
                                        <a href={`mailto:${row.member.email}`}>Send Email</a>
                                    ) : (
                                        <input type="text" placeholder="Email Address" disabled />
                                    )}
                                </td>
                                <td>{row.member ? "Joined" : ""}</td>
                                <td>
                                    {row.slot === 1 ? (
                                        <button className="members-outline-button" type="button" disabled>
                                            Add 2nd Manager
                                        </button>
                                    ) : null}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {loadError && <div className="members-error">{loadError}</div>}

                <section className="invite-options invite-options--disabled">
                    <h4>Invite Options</h4>

                    <div className="invite-options-grid">
                        <div className="invite-options-label">Send Invites to</div>
                        <div className="invite-options-controls">
                            <label>
                                <input
                                    type="radio"
                                    name="invite-target"
                                    checked={inviteTarget === "new-or-changed"}
                                    onChange={() => setInviteTarget("new-or-changed")}
                                    disabled
                                />
                                New managers and managers with changed email address
                            </label>

                            <label>
                                <input
                                    type="radio"
                                    name="invite-target"
                                    checked={inviteTarget === "not-joined"}
                                    onChange={() => setInviteTarget("not-joined")}
                                    disabled
                                />
                                Managers who have not joined
                            </label>
                        </div>
                    </div>

                    <div className="invite-options-grid">
                        <div className="invite-options-label">Send me a copy of each invite</div>
                        <div className="invite-options-controls">
                            <label className="toggle-row">
                                <input
                                    type="checkbox"
                                    checked={sendCopy}
                                    onChange={(e) => setSendCopy(e.target.checked)}
                                    disabled
                                />
                            </label>
                        </div>
                    </div>

                    <div className="invite-options-grid">
                        <div className="invite-options-label">Add custom message</div>
                        <div className="invite-options-controls">
                            <label className="toggle-row">
                                <input
                                    type="checkbox"
                                    checked={addCustomMessage}
                                    onChange={(e) => setAddCustomMessage(e.target.checked)}
                                    disabled
                                />
                            </label>
                        </div>
                    </div>
                </section>

                <div className="members-footer-actions">
                    <button className="members-disabled-button" type="button" disabled>
                        Submit Manager Info and/or Send Invites
                    </button>
                    <button
                        className="members-cancel-button"
                        type="button"
                        onClick={() => navigate(`/league/${leagueId}`)}
                    >
                        Cancel
                    </button>
                </div>
            </div>

            <button
                className="switch-league-button"
                type="button"
                onClick={() => navigate("/league-selection")}
            >
                Switch League
            </button>
        </div>
    );
}
