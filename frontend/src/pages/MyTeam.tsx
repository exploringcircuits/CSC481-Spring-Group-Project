import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PlayerImage from "../components/PlayerImage";
import { fetchLeague, type Player } from "../services/api";
import "../styles/MyTeam.css";

const rosterSlots = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL", "UTIL", "BE", "BE", "BE", "BE"];

interface LeagueMember {
    id: number;
    email: string;
    display_name: string;
    slot: number;
    is_commissioner: boolean;
}

interface LeagueTeam {
    id: number;
    member: LeagueMember;
    name: string;
}

interface LeagueData {
    id: number;
    name: string;
    members: LeagueMember[];
    teams: LeagueTeam[];
}

interface RosterRow {
    slot: string;
    player: Player | null;
}

const formatOne = (value: number | null | undefined) => (
    value == null || Number.isNaN(Number(value)) ? "--" : Number(value).toFixed(1)
);

const formatZero = (value: number | null | undefined) => (
    value == null || Number.isNaN(Number(value)) ? "--" : Math.round(Number(value)).toString()
);

const getDateLabels = () => {
    const offsets = [-1, 0, 1, 2, 3];
    return offsets.map((offset) => {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
        const day = date.getDate();
        const weekday = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
        return {
            key: `${month}-${day}`,
            labelTop: `${month} ${day}`,
            labelBottom: offset === 0 ? "TODAY" : weekday,
        };
    });
};

export default function MyTeam() {
    const navigate = useNavigate();
    const { leagueId, teamId } = useParams();
    const currentLeagueId = leagueId ?? localStorage.getItem("currentLeagueId") ?? "global";
    const draftStateKey = `draftState:${currentLeagueId}`;

    const [leagueData, setLeagueData] = useState<LeagueData | null>(null);
    const [loading, setLoading] = useState(true);
    const [rosters, setRosters] = useState<Record<number, Array<Player | null>>>({});
    const [slotFilter, setSlotFilter] = useState<"ALL" | "STARTERS" | "BENCH">("ALL");
    const [statView, setStatView] = useState<"totals" | "averages">("averages");

    useEffect(() => {
        const load = async () => {
            try {
                const parsedLeagueId = parseInt(currentLeagueId, 10);
                if (!Number.isNaN(parsedLeagueId)) {
                    const data = await fetchLeague(parsedLeagueId);
                    setLeagueData(data as unknown as LeagueData);
                }
            } catch {
                setLeagueData(null);
            } finally {
                setLoading(false);
            }
        };

        const raw = localStorage.getItem(draftStateKey);
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as { rosters?: Record<number, Array<Player | null>> };
                setRosters(parsed.rosters ?? {});
            } catch {
                setRosters({});
            }
        }

        load();
    }, [currentLeagueId, draftStateKey]);

    const teamOrder = useMemo(() => {
        if (!leagueData?.members) {
            return [];
        }

        return [...leagueData.members]
            .sort((a, b) => a.slot - b.slot)
            .map((member) => {
                const team = leagueData.teams?.find((t) => t.member?.id === member.id);
                return {
                    id: member.id,
                    displayName: member.display_name,
                    teamName: team?.name ?? member.display_name,
                };
            });
    }, [leagueData]);

    const ourTeamId = useMemo(() => {
        if (!leagueData?.members?.length) {
            return 0;
        }

        const currentUserEmail = localStorage.getItem("userEmail") ?? "";
        if (currentUserEmail) {
            const currentMember = leagueData.members.find(
                (m) => m.email.toLowerCase() === currentUserEmail.toLowerCase(),
            );
            if (currentMember) {
                return currentMember.id;
            }
        }

        return leagueData.members[0]?.id ?? 0;
    }, [leagueData]);

    const viewedTeamId = useMemo(() => {
        const parsedTeamId = parseInt(teamId ?? "", 10);
        return Number.isNaN(parsedTeamId) ? ourTeamId : parsedTeamId;
    }, [teamId, ourTeamId]);

    const isViewingOwnTeam = viewedTeamId === ourTeamId;

    const myTeam = teamOrder.find((team) => team.id === viewedTeamId);
    const myTeamName = myTeam?.teamName ?? "My Team";
    const managerName = myTeam?.displayName ?? "Manager";
    const myRoster = rosters[viewedTeamId] ?? [];

    const rosterRows: RosterRow[] = useMemo(
        () => rosterSlots.map((slot, index) => ({ slot, player: myRoster[index] ?? null })),
        [myRoster],
    );

    const draftedCount = rosterRows.filter((row) => row.player != null).length;
    const rosterPlayers = useMemo(
        () => rosterRows.map((row) => row.player).filter(Boolean) as Player[],
        [rosterRows],
    );

    const startersCount = useMemo(
        () => rosterRows.filter((row) => row.slot !== "BE" && row.player != null).length,
        [rosterRows],
    );

    const benchCount = useMemo(
        () => rosterRows.filter((row) => row.slot === "BE" && row.player != null).length,
        [rosterRows],
    );

    const avgFantasyPoints = useMemo(() => {
        if (rosterPlayers.length === 0) {
            return "--";
        }
        const total = rosterPlayers.reduce(
            (sum, player) => sum + (player.current_stats?.fantasy_points_avg ?? 0),
            0,
        );
        return (total / rosterPlayers.length).toFixed(1);
    }, [rosterPlayers]);

    const totalFantasyPoints = useMemo(
        () => Math.round(rosterPlayers.reduce(
            (sum, player) => sum + (player.current_stats?.fantasy_points_total ?? 0),
            0,
        )),
        [rosterPlayers],
    );

    const leagueTeamTotals = useMemo(
        () => teamOrder.map((team) => {
            const teamRoster = rosters[team.id] ?? [];
            const total = teamRoster.reduce((sum, player) => sum + (player?.current_stats?.fantasy_points_total ?? 0), 0);
            return { teamId: team.id, teamName: team.teamName, total };
        }).sort((a, b) => b.total - a.total),
        [teamOrder, rosters],
    );

    const leagueRank = useMemo(() => {
        const idx = leagueTeamTotals.findIndex((entry) => entry.teamId === viewedTeamId);
        return idx >= 0 ? idx + 1 : null;
    }, [leagueTeamTotals, viewedTeamId]);

    const nearestOpponent = useMemo(
        () => leagueTeamTotals.find((entry) => entry.teamId !== viewedTeamId) ?? null,
        [leagueTeamTotals, viewedTeamId],
    );

    const visibleRows = useMemo(() => {
        if (slotFilter === "STARTERS") {
            return rosterRows.filter((row) => row.slot !== "BE");
        }
        if (slotFilter === "BENCH") {
            return rosterRows.filter((row) => row.slot === "BE");
        }
        return rosterRows;
    }, [rosterRows, slotFilter]);

    const dateLabels = useMemo(getDateLabels, []);

    const rowStats = (player: Player | null) => {
        const stats = player?.current_stats;
        return {
            min: statView === "totals" ? formatOne(stats?.min_total) : formatOne(stats?.min_avg),
            fgm: statView === "totals" ? formatOne(stats?.fgm_total) : formatOne(stats?.fgm_avg),
            fga: statView === "totals" ? formatOne(stats?.fga_total) : formatOne(stats?.fga_avg),
            ftm: statView === "totals" ? formatOne(stats?.ftm_total) : formatOne(stats?.ftm_avg),
            fta: statView === "totals" ? formatOne(stats?.fta_total) : formatOne(stats?.fta_avg),
            fg3m: statView === "totals" ? formatOne(stats?.fg3m_total) : formatOne(stats?.fg3m_avg),
            reb: statView === "totals" ? formatOne(stats?.reb_total) : formatOne(stats?.reb_avg),
            ast: statView === "totals" ? formatOne(stats?.ast_total) : formatOne(stats?.ast_avg),
            stl: statView === "totals" ? formatOne(stats?.stl_total) : formatOne(stats?.stl_avg),
            blk: statView === "totals" ? formatOne(stats?.blk_total) : formatOne(stats?.blk_avg),
            tov: statView === "totals" ? formatOne(stats?.tov_total) : formatOne(stats?.tov_avg),
            pts: statView === "totals" ? formatOne(stats?.pts_total) : formatOne(stats?.pts_avg),
            plusMinus: statView === "totals" ? formatOne(stats?.plus_minus_total) : formatOne(stats?.plus_minus_avg),
            fpts: statView === "totals" ? formatZero(stats?.fantasy_points_total) : formatOne(stats?.fantasy_points_avg),
        };
    };

    return (
        <div className="my-team-page">
            <div className="my-team-shell">
                <section className="my-team-header-card">
                    <div className="my-team-header-top">
                        <div className="my-team-id-block">
                            <div className="my-team-logo-tile" aria-hidden="true">MT</div>
                            <div>
                                <h2>{myTeamName}</h2>
                                <p>{leagueData?.name ?? "League"} | {managerName}</p>
                                <div className="my-team-link-row">
                                    <span>{`Teams: ${teamOrder.length || "--"}`}</span>
                                    <span>{`Roster: ${draftedCount}/${rosterSlots.length}`}</span>
                                    <span>{`Rank: ${leagueRank ?? "--"}`}</span>
                                </div>
                            </div>
                        </div>
                        <button type="button" className="my-team-back" onClick={() => navigate(`/league/${currentLeagueId}`)}>
                            {isViewingOwnTeam ? "Back to League" : "Back to My Team"}
                        </button>
                    </div>

                    <div className="my-team-matchups">
                        <div className="my-team-matchup-box">
                            <h4>My Team</h4>
                            <div className="my-team-matchup-row">
                                <span>Fantasy Points (Total)</span>
                                <strong>{totalFantasyPoints}</strong>
                            </div>
                            <div className="my-team-matchup-row">
                                <span>Fantasy Points (Avg)</span>
                                <strong>{avgFantasyPoints}</strong>
                            </div>
                        </div>
                        <div className="my-team-matchup-box">
                            <h4>League Snapshot</h4>
                            <div className="my-team-matchup-row">
                                <span>Nearest Team</span>
                                <strong>{nearestOpponent?.teamName ?? "--"}</strong>
                            </div>
                            <div className="my-team-matchup-row">
                                <span>Nearest Total</span>
                                <strong>{nearestOpponent == null ? "--" : formatZero(nearestOpponent.total)}</strong>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="my-team-roster-card">
                    <div className="my-team-controls-row">
                        <div className="my-team-date-strip">
                            <span>Set Lineup:</span>
                            {dateLabels.map((day) => (
                                <button type="button" key={day.key} className={day.labelBottom === "TODAY" ? "active" : ""}>
                                    <small>{day.labelTop}</small>
                                    <strong>{day.labelBottom}</strong>
                                </button>
                            ))}
                        </div>

                        <div className="my-team-toolbar-controls">
                            <label>
                                View
                                <select value={slotFilter} onChange={(event) => setSlotFilter(event.target.value as "ALL" | "STARTERS" | "BENCH")}>
                                    <option value="ALL">All Slots</option>
                                    <option value="STARTERS">Starters</option>
                                    <option value="BENCH">Bench</option>
                                </select>
                            </label>
                            <div className="my-team-stat-toggle" role="group" aria-label="Stat view">
                                <button
                                    type="button"
                                    className={statView === "totals" ? "active" : ""}
                                    onClick={() => setStatView("totals")}
                                >
                                    Totals
                                </button>
                                <button
                                    type="button"
                                    className={statView === "averages" ? "active" : ""}
                                    onClick={() => setStatView("averages")}
                                >
                                    Averages
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="my-team-tabs-row">
                        <button type="button" className="active">Stats</button>
                        <button type="button" disabled>Trending</button>
                        <button type="button" disabled>Schedule</button>
                        <button type="button" disabled>News</button>
                    </div>

                    {loading ? (
                        <div className="my-team-empty">Loading roster...</div>
                    ) : (
                        <div className="my-team-table-wrap">
                            <table className="my-team-table">
                                <thead>
                                    <tr>
                                        <th>Slot</th>
                                        <th>Player</th>
                                        {isViewingOwnTeam ? <th>Action</th> : null}
                                        <th>Opp</th>
                                        <th>Status</th>
                                        <th>Min</th>
                                        <th>FGM</th>
                                        <th>FGA</th>
                                        <th>FTM</th>
                                        <th>FTA</th>
                                        <th>3PM</th>
                                        <th>REB</th>
                                        <th>AST</th>
                                        <th>STL</th>
                                        <th>BLK</th>
                                        <th>TO</th>
                                        <th>PTS</th>
                                        <th>%ROST</th>
                                        <th>+/-</th>
                                        <th>{statView === "totals" ? "FANTASY PTS TOT" : "FANTASY PTS AVG"}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleRows.map((row, index) => (
                                        <tr key={`${row.slot}-${index}`}>
                                            <td className="my-team-slot">{row.slot}</td>
                                            <td className="my-team-player-cell">
                                                {row.player ? (
                                                    <>
                                                        <PlayerImage
                                                            playerId={row.player.player_id}
                                                            playerName={row.player.full_name}
                                                            size={30}
                                                        />
                                                        <div>
                                                            <strong>{row.player.full_name}</strong>
                                                            <span>{row.player.team_abbreviation ?? "FA"} {row.player.position ?? "-"}</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="my-team-empty-player">Empty</span>
                                                )}
                                            </td>
                                            {isViewingOwnTeam ? (
                                                <td><button type="button" className="my-team-action-btn" disabled>MOVE</button></td>
                                            ) : null}
                                            <td>-</td>
                                            <td>{row.player?.injury_status ?? "-"}</td>
                                            <td>{rowStats(row.player).min}</td>
                                            <td>{rowStats(row.player).fgm}</td>
                                            <td>{rowStats(row.player).fga}</td>
                                            <td>{rowStats(row.player).ftm}</td>
                                            <td>{rowStats(row.player).fta}</td>
                                            <td>{rowStats(row.player).fg3m}</td>
                                            <td>{rowStats(row.player).reb}</td>
                                            <td>{rowStats(row.player).ast}</td>
                                            <td>{rowStats(row.player).stl}</td>
                                            <td>{rowStats(row.player).blk}</td>
                                            <td>{rowStats(row.player).tov}</td>
                                            <td>{rowStats(row.player).pts}</td>
                                            <td>{row.player == null ? "--" : formatOne(row.player.roster_percent)}</td>
                                            <td>{rowStats(row.player).plusMinus}</td>
                                            <td>{rowStats(row.player).fpts}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="my-team-footer-row">
                        <span>Starters: {startersCount} | Bench: {benchCount}</span>
                        <span>{loading ? "" : `${visibleRows.length} visible slots`}</span>
                    </div>
                </section>
            </div>
        </div>
    );
}
