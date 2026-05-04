import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPlayers, fetchTeams, fetchLeague, fetchDraftSettings, type DraftSettings, type Player } from "../services/api";
import PlayerImage from "../components/PlayerImage";
import "../styles/Draft.css";

const rosterSlots = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL", "UTIL", "BE", "BE", "BE", "BE"];
const MAX_CENTERS = 4;
const rosterLimitDefinitions = [
    { label: "PG", max: null },
    { label: "SG", max: null },
    { label: "SF", max: null },
    { label: "PF", max: null },
    { label: "C", max: MAX_CENTERS },
];

const SLOT_FULL_LABELS: Record<string, string> = {
    PG: "Point Guard (PG)",
    SG: "Shooting Guard (SG)",
    SF: "Small Forward (SF)",
    PF: "Power Forward (PF)",
    C: "Center (C)",
    G: "Guard (G)",
    F: "Forward (F)",
    UTIL: "Util (UTIL)",
    BE: "Bench (BE)",
};

const rulesRosterRows = (() => {
    const counts = new Map<string, number>();
    for (const slot of rosterSlots) {
        counts.set(slot, (counts.get(slot) ?? 0) + 1);
    }
    return [...counts.entries()].map(([slot, count]) => ({
        slot,
        label: SLOT_FULL_LABELS[slot] ?? slot,
        count,
    }));
})();

interface LeagueMember {
    id: number;
    email: string;
    display_name: string;
    slot: number;
    is_commissioner: boolean;
}

interface FantasyTeam {
    id: number;
    member: LeagueMember;
    name: string;
}

interface LeagueData {
    id: number;
    name: string;
    members: LeagueMember[];
    teams: FantasyTeam[];
    max_players: number;
}

interface DraftPick {
    overallPick: number;
    round: number;
    roundPick: number;
    teamId: number;
    player: Player;
}

interface ActivityEntry {
    id: number;
    type: "pick" | "message";
    teamId: number;
    text: string;
    pickNumber?: number;
    playerId?: number;
    playerName?: string;
    playerTeam?: string;
    playerPosition?: string;
    round?: number;
    roundPick?: number;
}

const getPositionParts = (position: string | null) => {
    if (!position) {
        return [];
    }

    return position
        .split(/[-/,\s]+/)
        .map((part) => part.trim().toUpperCase())
        .filter(Boolean);
};

const getBoardToneClass = (position: string | null) => {
    const primary = getPositionParts(position)[0] ?? "";
    return primary ? `draft-board-tone-${primary}` : "";
};

const canPlayerFitSlot = (player: Player, slot: string) => {
    const positions = getPositionParts(player.position);

    if (slot === "BE" || slot === "UTIL") {
        return true;
    }

    if (slot === "G") {
        return positions.some((position) => position === "PG" || position === "SG" || position === "G");
    }

    if (slot === "F") {
        return positions.some((position) => position === "SF" || position === "PF" || position === "F");
    }

    if (slot === "PG" || slot === "SG") {
        return positions.includes(slot) || positions.includes("G");
    }

    if (slot === "SF" || slot === "PF") {
        return positions.includes(slot) || positions.includes("F");
    }

    if (slot === "C") {
        return positions.includes("C");
    }

    return positions.includes(slot);
};

const hasPositionLabel = (player: Player, label: string) => {
    const positions = getPositionParts(player.position);

    if (label === "PG" || label === "SG") {
        return positions.includes(label) || positions.includes("G");
    }

    if (label === "SF" || label === "PF") {
        return positions.includes(label) || positions.includes("F");
    }

    if (label === "C") {
        return positions.includes("C");
    }

    return positions.includes(label);
};

const getAssignableSlotIndex = (player: Player, roster: Array<Player | null>) => {
    const centerCount = roster.reduce((total, rosterPlayer) => {
        if (!rosterPlayer) {
            return total;
        }
        return total + (hasPositionLabel(rosterPlayer, "C") ? 1 : 0);
    }, 0);

    if (hasPositionLabel(player, "C") && centerCount >= MAX_CENTERS) {
        return -1;
    }

    for (let index = 0; index < rosterSlots.length; index += 1) {
        if (roster[index] != null) {
            continue;
        }

        if (canPlayerFitSlot(player, rosterSlots[index])) {
            return index;
        }
    }

    return -1;
};

export default function Draft() {
    const navigate = useNavigate();
    const currentLeagueId = localStorage.getItem("currentLeagueId") ?? "global";
    const draftPauseKey = `draftPaused:${currentLeagueId}`;
    const draftStateKey = `draftState:${currentLeagueId}`;

    const [leagueData, setLeagueData] = useState<LeagueData | null>(null);
    const [leagueLoading, setLeagueLoading] = useState(true);
    const [draftSettings, setDraftSettings] = useState<DraftSettings | null>(null);

    // Fetch league data on mount
    useEffect(() => {
        const loadLeagueData = async () => {
            try {
                const leagueId = parseInt(currentLeagueId, 10);
                if (!Number.isNaN(leagueId)) {
                    const [data, settings] = await Promise.all([
                        fetchLeague(leagueId),
                        fetchDraftSettings(leagueId),
                    ]);
                    setLeagueData(data as unknown as LeagueData);
                    setDraftSettings(settings);
                    setPickTimerSeconds(settings.time_per_pick);
                    setTimerSeconds(settings.time_per_pick);
                }
            } catch (error) {
                console.error("Error fetching league data:", error);
            } finally {
                setLeagueLoading(false);
            }
        };

        if (currentLeagueId !== "global") {
            loadLeagueData();
        } else {
            setLeagueLoading(false);
        }
    }, [currentLeagueId]);

    // Build teamOrder from league members
    const teamOrder = useMemo(() => {
        if (!leagueData?.members) return [];
        return leagueData.members
            .sort((a, b) => a.slot - b.slot)
            .map((member) => {
                const team = leagueData.teams?.find((t) => t.member?.id === member.id);
                return {
                    id: member.id,
                    name: team?.name ?? member.display_name ?? `Team ${member.slot}`,
                };
            });
    }, [leagueData]);

    const leagueManagerName = useMemo(
        () => leagueData?.members.find((m) => m.is_commissioner)?.display_name
              ?? leagueData?.members[0]?.display_name
              ?? "Unknown",
        [leagueData],
    );

    // Find our team ID based on current user email (or default to commissioner)
    const ourTeamId = useMemo(() => {
        if (!leagueData?.members) return 0;
        
        const currentUserEmail = localStorage.getItem("userEmail") ?? "";
        
        // If we have a user email, try to match it
        if (currentUserEmail) {
            const currentMember = leagueData.members.find(
                (m) => m.email.toLowerCase() === currentUserEmail.toLowerCase()
            );
            if (currentMember) {
                return currentMember.id;
            }
        }
        
        // Default to the first member (commissioner) if no user email match
        return leagueData.members[0]?.id ?? 0;
    }, [leagueData]);

    const initialOrder = useMemo(() => {
        const ids = teamOrder.map((team) => team.id);
        for (let index = ids.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
        }
        return ids;
    }, [teamOrder]);

    const initialRosters = useMemo(() => {
        const rosters: Record<number, Array<Player | null>> = {};
        teamOrder.forEach((team) => {
            rosters[team.id] = Array.from({ length: rosterSlots.length }, () => null);
        });
        return rosters;
    }, [teamOrder]);

    const initialAutopick = useMemo(() => {
        const flags: Record<number, boolean> = {};
        teamOrder.forEach((team) => {
            flags[team.id] = team.id !== ourTeamId;
        });
        return flags;
    }, [ourTeamId, teamOrder]);

    const [players, setPlayers] = useState<Player[]>([]);
    const [draftPool, setDraftPool] = useState<Player[]>([]);
    const [teams, setTeams] = useState<{ abbreviation: string; name: string }[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPlayers, setTotalPlayers] = useState(0);
    const [loadingPlayers, setLoadingPlayers] = useState(true);
    const [playersError, setPlayersError] = useState<string | null>(null);
    const [selectedPosition, setSelectedPosition] = useState("All");
    const [selectedTeam, setSelectedTeam] = useState("All");
    const [statMode, setStatMode] = useState<"totals" | "averages">("averages");
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState("current_stats__fantasy_points_avg");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [draftOrder, setDraftOrder] = useState<number[]>(initialOrder);
    const [rosters, setRosters] = useState<Record<number, Array<Player | null>>>(initialRosters);
    const [autopickByTeam, setAutopickByTeam] = useState<Record<number, boolean>>(initialAutopick);
    const [viewRosterTeamId, setViewRosterTeamId] = useState<number>(ourTeamId);

    // Update draft state when league data loads
    useEffect(() => {
        if (leagueData && teamOrder.length > 0) {
            const persistedRaw = localStorage.getItem(draftStateKey);
            if (persistedRaw) {
                try {
                    const parsed = JSON.parse(persistedRaw) as {
                        draftOrder?: number[];
                        rosters?: Record<number, Array<Player | null>>;
                        draftedPlayerIds?: number[];
                        pickHistory?: DraftPick[];
                        currentPickIndex?: number;
                    };
                    const persistedOrder = parsed.draftOrder ?? [];
                    setDraftOrder(
                        persistedOrder.length === teamOrder.length ? persistedOrder : initialOrder,
                    );
                    setRosters(parsed.rosters ?? initialRosters);
                    setDraftedPlayerIds(parsed.draftedPlayerIds ?? []);
                    setPickHistory(parsed.pickHistory ?? []);
                    setCurrentPickIndex(parsed.currentPickIndex ?? 0);
                } catch {
                    setDraftOrder(initialOrder);
                    setRosters(initialRosters);
                }
            } else {
                setDraftOrder(initialOrder);
                setRosters(initialRosters);
            }
            setAutopickByTeam(initialAutopick);
            setViewRosterTeamId(ourTeamId);
        }
    }, [leagueData, teamOrder, initialOrder, initialRosters, initialAutopick, ourTeamId, draftStateKey]);
    const [draftedPlayerIds, setDraftedPlayerIds] = useState<number[]>([]);
    const [pickHistory, setPickHistory] = useState<DraftPick[]>([]);
    const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([]);
    const [activityFilter, setActivityFilter] = useState<"all" | "picks" | "messages">("all");
    const [activityMessage, setActivityMessage] = useState("");
    const [activeTab, setActiveTab] = useState<"players" | "pick-history" | "board" | "rules" | "league-manager">("players");
    const [commissionerPickMode, setCommissionerPickMode] = useState(false);
    const [historyRoundFilter, setHistoryRoundFilter] = useState<"all" | number>("all");
    const [boardViewMode, setBoardViewMode] = useState<"round" | "roster">("round");
    const [boardRoundFilter, setBoardRoundFilter] = useState<"all" | number>("all");
    const [queuePlayerIds, setQueuePlayerIds] = useState<number[]>([]);
    const [currentPickIndex, setCurrentPickIndex] = useState(0);
    const [pickTimerSeconds, setPickTimerSeconds] = useState(90);
    const [timerSeconds, setTimerSeconds] = useState(90);
    const [draftReady, setDraftReady] = useState(false);
    const [isDraftPaused, setIsDraftPaused] = useState(
        () => localStorage.getItem(draftPauseKey) === "true",
    );
    const [slowAutopick, setSlowAutopick] = useState(
        () => localStorage.getItem("slowAutopick") === "true",
    );
    const leagueManagerLocked = !isDraftPaused;

    const ROWS_PER_PAGE = 50;
    const positionOptions = ["All", "PG", "SG", "SF", "PF", "C", "G", "F"];
    const pickCellRefs = useRef<Array<HTMLDivElement | null>>([]);
    const pickTrackRef = useRef<HTMLDivElement | null>(null);
    const hasDraftOrder = draftOrder.length > 0;

    const totalPicks = draftOrder.length * rosterSlots.length;
    const totalRounds = rosterSlots.length;
    const draftComplete = !hasDraftOrder || currentPickIndex >= totalPicks;
    const currentRound = hasDraftOrder ? Math.floor(currentPickIndex / draftOrder.length) + 1 : 1;
    const displayRound = Math.min(currentRound, totalRounds);
    const roundPickIndex = hasDraftOrder ? currentPickIndex % draftOrder.length : 0;
    const isSnakeForward = currentRound % 2 === 1;
    const activeOrderIndex = isSnakeForward
        ? roundPickIndex
        : draftOrder.length - 1 - roundPickIndex;
    const activeTeamId = draftOrder[Math.max(0, activeOrderIndex)] ?? draftOrder[0];
    const activeTeamName = teamOrder.find((team) => team.id === activeTeamId)?.name ?? "Waiting";
    const isOurTurn = !draftComplete && (commissionerPickMode || (activeTeamId === ourTeamId && !autopickByTeam[ourTeamId]));
    const isAutopickTurn = !draftComplete && !commissionerPickMode && (activeTeamId !== ourTeamId || !!autopickByTeam[ourTeamId]);

    const draftedPlayerSet = useMemo(() => new Set(draftedPlayerIds), [draftedPlayerIds]);
    const availableDraftPlayers = useMemo(
        () => draftPool.filter((player) => !draftedPlayerSet.has(player.id)),
        [draftPool, draftedPlayerSet],
    );

    const userRoster = rosters[ourTeamId] ?? [];
    const ourTeamName = teamOrder.find((team) => team.id === ourTeamId)?.name ?? "My Team";
    const viewedRoster = rosters[viewRosterTeamId] ?? [];
    const rosterCount = viewedRoster.filter(Boolean).length;
    const countPositionForRoster = (roster: Array<Player | null>, label: string) => (
        roster.reduce((total, rosterPlayer) => {
            if (!rosterPlayer) {
                return total;
            }
            return total + (hasPositionLabel(rosterPlayer, label) ? 1 : 0);
        }, 0)
    );
    const viewedRosterLimitRows = useMemo(
        () => rosterLimitDefinitions.map((limit) => {
            const count = countPositionForRoster(viewedRoster, limit.label);
            return {
                ...limit,
                value: `${count}/${limit.max ?? "-"}`,
            };
        }),
        [viewedRoster],
    );
    const ourCenterLimitReached = useMemo(
        () => countPositionForRoster(userRoster, "C") >= MAX_CENTERS,
        [userRoster],
    );

    const ordering = useMemo(() => {
        if (sortField === "adp") {
            return sortDirection === "asc" ? "-roster_percent" : "roster_percent";
        }

        const prefix = sortDirection === "desc" ? "-" : "";
        return `${prefix}${sortField}`;
    }, [sortDirection, sortField]);

    const sortArrow = (field: string) => {
        if (sortField !== field) {
            return null;
        }

        return sortDirection === "asc" ? " ↑" : " ↓";
    };

    const getModeStatField = (baseName: string) => {
        const suffix = statMode === "totals" ? "total" : "avg";
        return `current_stats__${baseName}_${suffix}`;
    };

    const handleSort = (field: string) => {
        setCurrentPage(1);
        if (sortField === field) {
            setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
            return;
        }

        setSortField(field);
        setSortDirection("desc");
    };

    const getBestAvailableForTeam = (teamId: number, preferQueue: boolean) => {
        const roster = rosters[teamId] ?? [];

        if (preferQueue) {
            for (const queuedPlayerId of queuePlayerIds) {
                const player = availableDraftPlayers.find((candidate) => candidate.id === queuedPlayerId);
                if (!player) {
                    continue;
                }
                if (getAssignableSlotIndex(player, roster) >= 0) {
                    return player;
                }
            }
        }

        for (const player of availableDraftPlayers) {
            if (getAssignableSlotIndex(player, roster) >= 0) {
                return player;
            }
        }

        return null;
    };

    const addActivity = (entry: Omit<ActivityEntry, "id">) => {
        setActivityFeed((previous) => [
            { ...entry, id: previous.length + 1 },
            ...previous,
        ]);
    };

    const commitPick = (teamId: number, player: Player, pickLabel?: string) => {
        if (isDraftPaused) {
            return false;
        }

        const roster = rosters[teamId] ?? [];
        const slotIndex = getAssignableSlotIndex(player, roster);
        if (slotIndex < 0) {
            return false;
        }

        const overallPick = currentPickIndex + 1;
        const round = Math.floor(currentPickIndex / draftOrder.length) + 1;
        const roundPick = (currentPickIndex % draftOrder.length) + 1;
        const teamName = teamOrder.find((team) => team.id === teamId)?.name ?? "Unknown Team";

        setRosters((previous) => {
            const nextRosters = { ...previous };
            const nextTeamRoster = [...(nextRosters[teamId] ?? [])];
            nextTeamRoster[slotIndex] = player;
            nextRosters[teamId] = nextTeamRoster;
            return nextRosters;
        });
        setDraftedPlayerIds((previous) => [...previous, player.id]);
        setQueuePlayerIds((previous) => previous.filter((queuedId) => queuedId !== player.id));
        setPickHistory((previous) => [
            ...previous,
            {
                overallPick,
                round,
                roundPick,
                teamId,
                player,
            },
        ]);
        addActivity({
            type: "pick",
            teamId,
            text: `${teamName} drafted ${player.full_name} (${player.team_abbreviation ?? "FA"} ${player.position ?? ""}).${pickLabel ? ` ${pickLabel}` : ""}`,
            pickNumber: overallPick,
            playerId: player.player_id,
            playerName: player.full_name,
            playerTeam: player.team_abbreviation ?? "FA",
            playerPosition: player.position ?? "-",
            round,
            roundPick,
        });
        setCurrentPickIndex((previous) => previous + 1);
        return true;
    };

    const attemptAutoPick = (teamId: number, fromQueue: boolean) => {
        const candidate = getBestAvailableForTeam(teamId, fromQueue);
        if (!candidate) {
            return;
        }

        const autopickLabel = fromQueue ? "Queue target hit." : "Autopick activated.";
        commitPick(teamId, candidate, autopickLabel);
    };

    const undoPick = (overallPick: number) => {
        const pickIndex = pickHistory.findIndex((p) => p.overallPick === overallPick);
        if (pickIndex < 0) return;
        const picksToUndo = pickHistory.slice(pickIndex);
        const undoneIds = new Set(picksToUndo.map((p) => p.player.id));
        setPickHistory((previous) => previous.slice(0, pickIndex));
        setDraftedPlayerIds((previous) => previous.filter((id) => !undoneIds.has(id)));
        setRosters((previous) => {
            const next = { ...previous };
            for (const pick of picksToUndo) {
                const teamRoster = [...(next[pick.teamId] ?? [])];
                const slotIdx = teamRoster.findIndex((p) => p?.id === pick.player.id);
                if (slotIdx >= 0) teamRoster[slotIdx] = null;
                next[pick.teamId] = teamRoster;
            }
            return next;
        });
        setActivityFeed((previous) => previous.filter(
            (e) => !(e.type === "pick" && e.pickNumber != null && e.pickNumber >= overallPick),
        ));
        setCurrentPickIndex(pickIndex);
    };

    const handleActionClick = (player: Player) => {
        if (draftedPlayerSet.has(player.id)) {
            return;
        }

        if (isDraftPaused) {
            return;
        }

        if (isOurTurn || commissionerPickMode) {
            commitPick(commissionerPickMode ? activeTeamId : ourTeamId, player);
            return;
        }

        setQueuePlayerIds((previous) => (
            previous.includes(player.id)
                ? previous.filter((queuedId) => queuedId !== player.id)
                : [...previous, player.id]
        ));
    };

    const handleSendMessage = () => {
        const text = activityMessage.trim();
        if (!text) {
            return;
        }

        addActivity({
            type: "message",
            teamId: ourTeamId,
            text,
        });
        setActivityMessage("");
    };

    useEffect(() => {
        setQueuePlayerIds((previous) => previous.filter((queuedId) => !draftedPlayerSet.has(queuedId)));
    }, [draftedPlayerSet]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setSearchQuery(searchInput.trim());
            setCurrentPage(1);
        }, 250);

        return () => clearTimeout(timeout);
    }, [searchInput]);

    useEffect(() => {
        const loadTeams = async () => {
            try {
                const fetchedTeams = await fetchTeams();
                setTeams(fetchedTeams);
            } catch {
                setTeams([]);
            }
        };

        loadTeams();
    }, []);

    useEffect(() => {
        const syncPauseState = () => {
            setIsDraftPaused(localStorage.getItem(draftPauseKey) === "true");
        };

        const handleCustomPauseChange = (event: Event) => {
            const customEvent = event as CustomEvent<{ paused: boolean; key: string }>;
            if (customEvent.detail?.key === draftPauseKey) {
                setIsDraftPaused(Boolean(customEvent.detail.paused));
            }
        };

        window.addEventListener("storage", syncPauseState);
        window.addEventListener("draft-pause-changed", handleCustomPauseChange);

        const handleSlowAutopickChange = (event: Event) => {
            const customEvent = event as CustomEvent<{ slow: boolean }>;
            setSlowAutopick(Boolean(customEvent.detail?.slow));
        };
        window.addEventListener("slow-autopick-changed", handleSlowAutopickChange);

        return () => {
            window.removeEventListener("storage", syncPauseState);
            window.removeEventListener("draft-pause-changed", handleCustomPauseChange);
            window.removeEventListener("slow-autopick-changed", handleSlowAutopickChange);
        };
    }, [draftPauseKey]);

    useEffect(() => {
        const loadDraftPool = async () => {
            const target = totalPicks + 20;
            const collected: Player[] = [];
            const seen = new Set<number>();

            try {
                let page = 1;
                while (collected.length < target && page <= 12) {
                    const response = await fetchPlayers({
                        season: "2025-26",
                        stat_period: "season",
                        ordering: "-current_stats__fantasy_points_avg",
                        page,
                    });

                    for (const player of response.results ?? []) {
                        if (seen.has(player.id)) {
                            continue;
                        }
                        seen.add(player.id);
                        collected.push(player);
                    }

                    if (!response.next) {
                        break;
                    }
                    page += 1;
                }
            } catch {
                // Preserve draft page behavior even if pool loading partially fails.
            }

            setDraftPool(collected);
            setDraftReady(collected.length > 0);
        };

        loadDraftPool();
    }, [totalPicks]);

    useEffect(() => {
        const loadPlayers = async () => {
            try {
                setLoadingPlayers(true);
                setPlayersError(null);
                const draftedSet = new Set(draftedPlayerIds);
                const collected: Player[] = [];
                const seen = new Set<number>();
                let page = currentPage;
                let hasNext = true;
                let totalCount = 0;

                while (collected.length < ROWS_PER_PAGE && hasNext) {
                    const response = await fetchPlayers({
                        season: "2025-26",
                        stat_period: "season",
                        position: selectedPosition,
                        team: selectedTeam,
                        search: searchQuery,
                        ordering,
                        page,
                    });

                    if (page === currentPage) {
                        totalCount = response.count ?? (response.results?.length ?? 0);
                    }

                    for (const player of response.results ?? []) {
                        if (draftedSet.has(player.id) || seen.has(player.id)) {
                            continue;
                        }

                        if (ourCenterLimitReached && hasPositionLabel(player, "C")) {
                            continue;
                        }

                        seen.add(player.id);
                        collected.push(player);

                        if (collected.length >= ROWS_PER_PAGE) {
                            break;
                        }
                    }

                    hasNext = Boolean(response.next);
                    page += 1;
                }

                setPlayers(collected);
                setTotalPlayers(totalCount);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to load players.";
                setPlayersError(message);
            } finally {
                setLoadingPlayers(false);
            }
        };

        loadPlayers();
    }, [currentPage, ordering, searchQuery, selectedPosition, selectedTeam, statMode, draftedPlayerIds, ourCenterLimitReached]);

    useEffect(() => {
        setTimerSeconds(pickTimerSeconds);
    }, [currentPickIndex, pickTimerSeconds]);

    useEffect(() => {
        if (draftComplete || !draftReady || isDraftPaused || (isAutopickTurn && !slowAutopick)) {
            return;
        }

        const timer = window.setInterval(() => {
            setTimerSeconds((previous) => (previous > 0 ? previous - 1 : 0));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [draftComplete, draftReady, isDraftPaused, isAutopickTurn, slowAutopick]);

    useEffect(() => {
        if (draftComplete || !draftReady || isDraftPaused || !isAutopickTurn || !hasDraftOrder) {
            return;
        }

        const timeout = window.setTimeout(() => {
            attemptAutoPick(activeTeamId, activeTeamId === ourTeamId);
        }, slowAutopick ? 10000 : 150);

        return () => window.clearTimeout(timeout);
    }, [activeTeamId, ourTeamId, currentPickIndex, draftComplete, draftReady, isDraftPaused, isAutopickTurn, hasDraftOrder, slowAutopick]);

    useEffect(() => {
        if (draftComplete || !draftReady || isDraftPaused) {
            return;
        }

        if (isAutopickTurn) {
            return;
        }

        if (timerSeconds > 0) {
            return;
        }

        attemptAutoPick(activeTeamId, activeTeamId === ourTeamId);
    }, [activeTeamId, ourTeamId, currentPickIndex, draftComplete, draftReady, isDraftPaused, timerSeconds, draftOrder, autopickByTeam, isAutopickTurn]);

    useEffect(() => {
        const track = pickTrackRef.current;
        const activeCell = pickCellRefs.current[currentPickIndex];
        if (!track || !activeCell) {
            return;
        }

        const targetLeft = Math.max(0, activeCell.offsetLeft - 2);
        track.scrollTo({
            left: targetLeft,
            behavior: "smooth",
        });
    }, [currentPickIndex]);

    useEffect(() => {
        if (!teamOrder.length) {
            return;
        }

        localStorage.setItem(
            draftStateKey,
            JSON.stringify({
                draftOrder,
                rosters,
                draftedPlayerIds,
                pickHistory,
                currentPickIndex,
            }),
        );
    }, [teamOrder.length, draftStateKey, draftOrder, rosters, draftedPlayerIds, pickHistory, currentPickIndex]);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(totalPlayers / ROWS_PER_PAGE)),
        [totalPlayers],
    );

    const filteredActivity = useMemo(() => {
        if (activityFilter === "all") {
            return activityFeed;
        }

        if (activityFilter === "messages") {
            return activityFeed.filter((item) => item.type === "message");
        }

        return activityFeed.filter((item) => item.type === "pick");
    }, [activityFeed, activityFilter]);

    const historyRounds = useMemo(
        () => Array.from(new Set(pickHistory.map((pick) => pick.round))).sort((a, b) => a - b),
        [pickHistory],
    );

    const visiblePickHistory = useMemo(
        () => (historyRoundFilter === "all" ? pickHistory : pickHistory.filter((pick) => pick.round === historyRoundFilter)),
        [pickHistory, historyRoundFilter],
    );

    const pickHistoryByRound = useMemo(() => {
        const grouped = new Map<number, DraftPick[]>();
        [...visiblePickHistory]
            .sort((a, b) => a.overallPick - b.overallPick)
            .forEach((pick) => {
                if (!grouped.has(pick.round)) {
                    grouped.set(pick.round, []);
                }
                grouped.get(pick.round)?.push(pick);
            });

        return Array.from(grouped.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([round, picks]) => ({ round, picks }));
    }, [visiblePickHistory]);

    const boardTeamColumns = useMemo(
        () => draftOrder.map((teamId) => teamOrder.find((team) => team.id === teamId)).filter(Boolean) as Array<{ id: number; name: string }>,
        [draftOrder, teamOrder],
    );

    const boardVisibleRounds = useMemo(
        () => (boardRoundFilter === "all" ? historyRounds : historyRounds.filter((round) => round === boardRoundFilter)),
        [historyRounds, boardRoundFilter],
    );

    const autopickCandidate = useMemo(() => {
        if (draftComplete) {
            return null;
        }
        return getBestAvailableForTeam(activeTeamId, activeTeamId === ourTeamId);
    }, [activeTeamId, draftComplete, draftedPlayerIds, rosters, queuePlayerIds, draftPool]);

    const topTrackPicks = useMemo(() => {
        return Array.from({ length: totalPicks }, (_, index) => {
            const round = Math.floor(index / draftOrder.length) + 1;
            const pickInRound = index % draftOrder.length;
            const forward = round % 2 === 1;
            const orderIndex = forward ? pickInRound : draftOrder.length - 1 - pickInRound;
            const teamId = draftOrder[orderIndex];
            const pick = pickHistory.find((entry) => entry.overallPick === index + 1);
            return {
                overallPick: index + 1,
                teamId,
                teamName: teamOrder.find((team) => team.id === teamId)?.name ?? "Team",
                pick,
            };
        });
    }, [draftOrder, pickHistory, teamOrder, totalPicks]);

    const formatNumber = (value: number | null | undefined, digits = 1) => {
        if (value == null || Number.isNaN(Number(value))) {
            return "-";
        }
        return Number(value).toFixed(digits);
    };

    const formatInteger = (value: number | null | undefined) => {
        if (value == null || Number.isNaN(Number(value))) {
            return "-";
        }
        return Math.round(Number(value)).toString();
    };

    const adpFromRosterPercent = (rosterPercent: number | null | undefined) => {
        if (rosterPercent == null || rosterPercent <= 0) {
            return "-";
        }
        return (100 / rosterPercent).toFixed(1);
    };

    const draftedRosterRows = useMemo(
        () => rosterSlots
            .map((slot, index) => ({
                slot,
                player: userRoster[index] ?? null,
            }))
            .filter((entry) => entry.player != null),
        [userRoster],
    );

    return (
        <div className="draft-room-page">
            {leagueLoading || teamOrder.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center" }}>
                    <p>Loading draft room...</p>
                </div>
            ) : (
                <>
                    <div className="draft-track-bar">
                        <div className="draft-timer-block">
                            <span className="draft-round-counter">RND {displayRound} OF {totalRounds}</span>
                            {(draftComplete || isDraftPaused) && <span>{draftComplete ? "DRAFT" : "PAUSED"}</span>}
                            <strong>
                                {draftComplete
                                    ? "DONE"
                                    : isDraftPaused
                                        ? "HOLD"
                                        : `${Math.floor(timerSeconds / 60).toString().padStart(2, "0")}:${(timerSeconds % 60).toString().padStart(2, "0")}`}
                            </strong>
                        </div>
                <div className="draft-track-scroll" ref={pickTrackRef}>
                    {topTrackPicks.map((trackPick, index) => {
                        const round = Math.floor(trackPick.overallPick / draftOrder.length) + 1;
                        const isFirstPickOfRound = (trackPick.overallPick - 1) % draftOrder.length === 0;
                        
                        return (
                            <>
                                {isFirstPickOfRound && (
                                    <div
                                        key={`round-divider-${round}`}
                                        className="draft-round-divider"
                                    >
                                        <span>ROUND {round}</span>
                                    </div>
                                )}
                                <div
                                    key={`track-pick-${trackPick.overallPick}`}
                                    ref={(cell) => {
                                        pickCellRefs.current[index] = cell;
                                    }}
                                    className={`draft-track-cell ${index === currentPickIndex && !draftComplete ? "active" : ""} ${trackPick.pick ? "picked" : ""}`}
                                >
                                    <small>PICK {trackPick.overallPick}</small>
                                    <span>{trackPick.teamName}</span>
                                    {trackPick.pick ? <em>{trackPick.pick.player.full_name}</em> : null}
                                </div>
                            </>
                        );
                    })}
                </div>
            </div>

            {isDraftPaused && (
                <div className="draft-paused-banner">Draft paused by commissioner. Resume from Admin menu to continue.</div>
            )}

            <div className="draft-room-shell">
                <aside className="draft-left-rail">
                    <div className="draft-rail-block">
                        <div className="draft-rail-title">Pick Queue</div>
                        <div className="draft-autopick">
                            <span>Autopick</span>
                            <button
                                type="button"
                                className={`draft-toggle-button ${autopickByTeam[ourTeamId] ? "on" : "off"}`}
                                onClick={() => setAutopickByTeam((previous) => ({
                                    ...previous,
                                    [ourTeamId]: !previous[ourTeamId],
                                }))}
                            >
                                {autopickByTeam[ourTeamId] ? "ON" : "OFF"}
                            </button>
                        </div>
                        {queuePlayerIds.length === 0 ? (
                            <p className="draft-empty-note">No players in queue</p>
                        ) : (
                            <ol className="draft-queue-list">
                                {queuePlayerIds.map((queuedPlayerId) => {
                                    const queuedPlayer = draftPool.find((candidate) => candidate.id === queuedPlayerId);
                                    if (!queuedPlayer) {
                                        return null;
                                    }

                                    const eligText = getPositionParts(queuedPlayer.position).join(", ") || "-";
                                    return (
                                        <li key={queuedPlayer.id}>
                                            <span className="draft-queue-player-name">{queuedPlayer.full_name}</span>
                                            <span className="draft-queue-player-elig">{eligText}</span>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </div>

                    <div className="draft-rail-block draft-roster-block">
                        <div className="draft-rail-title roster-title-row">
                            <span>Roster</span>
                            <select
                                value={viewRosterTeamId}
                                onChange={(event) => setViewRosterTeamId(parseInt(event.target.value, 10))}
                            >
                                {teamOrder.map((team) => (
                                    <option key={team.id} value={team.id}>{team.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="draft-roster-table">
                            <div className="draft-roster-header-row">
                                <span>POS</span>
                                <span>PLAYER</span>
                                <span>ELIG</span>
                            </div>
                            {rosterSlots.map((slot, index) => {
                                const rosterPlayer = viewedRoster[index];
                                const eligText = rosterPlayer
                                    ? getPositionParts(rosterPlayer.position).join(", ") || "-"
                                    : "-";

                                return (
                                    <div key={`${slot}-${index}`} className="draft-roster-data-row">
                                        <span className="draft-roster-pos">{slot}</span>
                                        <span className="draft-roster-player">{rosterPlayer?.full_name ?? "Empty"}</span>
                                        <span className="draft-roster-elig">{eligText}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="draft-rail-block draft-roster-limits-block">
                        <div className="draft-roster-limits-header">
                            <span className="draft-rail-title">Roster Limits</span>
                            <span className="draft-roster-limit-total">{rosterCount}/{rosterSlots.length} Players</span>
                        </div>
                        <div className="draft-roster-limits-grid">
                            {viewedRosterLimitRows.map((limit) => (
                                <div key={limit.label} className="draft-roster-limit-item">
                                    <span>{limit.label}</span>
                                    <strong>{limit.value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                <main className="draft-center-board">
                    <header className="draft-board-header">
                        <h2>
                            {draftComplete
                                ? "Draft complete. Time to dominate the season."
                                : `Round ${currentRound}, Pick ${roundPickIndex + 1}: ${activeTeamName} is on the clock`}
                        </h2>
                        <p>
                            {draftComplete
                                ? `You filled ${userRoster.filter(Boolean).length}/${rosterSlots.length} roster slots.`
                                : isOurTurn
                                    ? "You are up. Queue buttons are now DRAFT buttons."
                                    : `Autopick preview: ${autopickCandidate?.full_name ?? "No eligible players"}`}
                        </p>
                        {!draftComplete && autopickCandidate ? (
                            <div className="draft-autopick-preview">
                                <PlayerImage
                                    playerId={autopickCandidate.player_id}
                                    playerName={autopickCandidate.full_name}
                                    size={30}
                                />
                                <span>
                                    {autopickCandidate.full_name} • {autopickCandidate.team_abbreviation ?? "FA"} {autopickCandidate.position ?? ""}
                                </span>
                            </div>
                        ) : null}
                    </header>

                    <nav className="draft-board-tabs">
                        <button
                            type="button"
                            className={activeTab === "players" ? "active" : ""}
                            onClick={() => setActiveTab("players")}
                        >
                            Players
                        </button>
                        <button
                            type="button"
                            className={activeTab === "pick-history" ? "active" : ""}
                            onClick={() => setActiveTab("pick-history")}
                        >
                            Pick History
                        </button>
                        <button
                            type="button"
                            className={activeTab === "board" ? "active" : ""}
                            onClick={() => setActiveTab("board")}
                        >
                            Board
                        </button>
                        <button
                            type="button"
                            className={activeTab === "rules" ? "active" : ""}
                            onClick={() => setActiveTab("rules")}
                        >
                            Rules
                        </button>
                        <button
                            type="button"
                            className={activeTab === "league-manager" ? "active" : ""}
                            onClick={() => setActiveTab("league-manager")}
                        >
                            League Manager
                        </button>
                    </nav>

                    {activeTab === "players" ? (
                        <>
                    <div className="draft-filters-row">
                        <div className="draft-filter-group">
                            <button type="button" disabled className="draft-filter-disabled">2026 Projected</button>
                            <select
                                value={selectedPosition}
                                onChange={(event) => {
                                    setSelectedPosition(event.target.value);
                                    setCurrentPage(1);
                                }}
                            >
                                {positionOptions.map((positionOption) => (
                                    <option key={positionOption} value={positionOption}>
                                        {positionOption === "All" ? "All Pos." : positionOption}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={selectedTeam}
                                onChange={(event) => {
                                    setSelectedTeam(event.target.value);
                                    setCurrentPage(1);
                                }}
                            >
                                <option value="All">All NBA Teams</option>
                                {teams.map((team) => (
                                    <option key={team.abbreviation} value={team.abbreviation}>
                                        {team.abbreviation}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className={statMode === "totals" ? "selected" : ""}
                                onClick={() => {
                                    setStatMode("totals");
                                    setCurrentPage(1);
                                    setSortField("current_stats__fantasy_points_total");
                                    setSortDirection("desc");
                                }}
                            >
                                Totals
                            </button>
                            <button
                                type="button"
                                className={statMode === "averages" ? "selected" : ""}
                                onClick={() => {
                                    setStatMode("averages");
                                    setCurrentPage(1);
                                    setSortField("current_stats__fantasy_points_avg");
                                    setSortDirection("desc");
                                }}
                            >
                                Averages
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Player Name"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                        />
                    </div>

                    <div className="draft-player-table-wrap">
                        <table className="draft-player-table">
                            <thead>
                                <tr>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("fantasy_points"))}>RK{sortArrow(getModeStatField("fantasy_points"))}</th>
                                    <th className="sortable" onClick={() => handleSort("full_name")}>PLAYER{sortArrow("full_name")}</th>
                                    <th></th>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("fantasy_points"))}>FPTS{sortArrow(getModeStatField("fantasy_points"))}</th>
                                    <th className="sortable" onClick={() => handleSort("current_stats__games_played")}>GP{sortArrow("current_stats__games_played")}</th>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("min"))}>MIN{sortArrow(getModeStatField("min"))}</th>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("fgm"))}>FGM{sortArrow(getModeStatField("fgm"))}</th>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("fga"))}>FGA{sortArrow(getModeStatField("fga"))}</th>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("ftm"))}>FTM{sortArrow(getModeStatField("ftm"))}</th>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("fta"))}>FTA{sortArrow(getModeStatField("fta"))}</th>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("fg3m"))}>3PM{sortArrow(getModeStatField("fg3m"))}</th>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("reb"))}>REB{sortArrow(getModeStatField("reb"))}</th>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("ast"))}>AST{sortArrow(getModeStatField("ast"))}</th>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("stl"))}>STL{sortArrow(getModeStatField("stl"))}</th>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("blk"))}>BLK{sortArrow(getModeStatField("blk"))}</th>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("tov"))}>TO{sortArrow(getModeStatField("tov"))}</th>
                                    <th className="sortable" onClick={() => handleSort(getModeStatField("pts"))}>PTS{sortArrow(getModeStatField("pts"))}</th>
                                    <th className="sortable" onClick={() => handleSort("adp")}>ADP{sortArrow("adp")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingPlayers && (
                                    <tr>
                                        <td colSpan={18} className="draft-table-status">Loading players...</td>
                                    </tr>
                                )}

                                {!loadingPlayers && playersError && (
                                    <tr>
                                        <td colSpan={18} className="draft-table-status draft-table-status-error">{playersError}</td>
                                    </tr>
                                )}

                                {!loadingPlayers && !playersError && players.length === 0 && (
                                    <tr>
                                        <td colSpan={18} className="draft-table-status">No players found.</td>
                                    </tr>
                                )}

                                {!loadingPlayers && !playersError && players.map((player, index) => {
                                    const stats = player.current_stats;
                                    const injuryTag = player.injury_status ? player.injury_status.toUpperCase() : null;
                                    const rowRank = (currentPage - 1) * ROWS_PER_PAGE + index + 1;

                                    return (
                                        <tr key={player.id}>
                                            <td>{rowRank}</td>
                                            <td className="draft-player-cell">
                                                <span className="draft-player-image-wrap">
                                                    <PlayerImage playerId={player.player_id} playerName={player.full_name} size={24} />
                                                </span>
                                                <div className="draft-player-meta">
                                                    <strong>{player.full_name}</strong>
                                                    <span className="draft-player-subline">
                                                        <span className="draft-player-team">{player.team_abbreviation ?? "FA"}</span>
                                                        <span className="draft-position-tabs">
                                                            {getPositionParts(player.position).map((positionPart, positionIndex) => (
                                                                <span
                                                                    key={`${player.id}-${positionPart}-${positionIndex}`}
                                                                    className={`draft-position-tab draft-position-${positionPart}`}
                                                                >
                                                                    {positionPart}
                                                                </span>
                                                            ))}
                                                        </span>
                                                        {injuryTag ? <em>{injuryTag}</em> : null}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <button
                                                    className={`queue-chip ${isOurTurn ? "draft-now" : ""} ${queuePlayerIds.includes(player.id) ? "queued" : ""}`}
                                                    onClick={() => handleActionClick(player)}
                                                    disabled={draftComplete || isDraftPaused}
                                                >
                                                    {isOurTurn ? "DRAFT" : queuePlayerIds.includes(player.id) ? "QUEUED" : "QUEUE"}
                                                </button>
                                            </td>
                                            <td>{statMode === "totals" ? formatNumber(stats?.fantasy_points_total) : formatNumber(stats?.fantasy_points_avg)}</td>
                                            <td>{formatInteger(stats?.games_played)}</td>
                                            <td>{statMode === "totals" ? formatNumber(stats?.min_total) : formatNumber(stats?.min_avg)}</td>
                                            <td>{statMode === "totals" ? formatNumber(stats?.fgm_total) : formatNumber(stats?.fgm_avg)}</td>
                                            <td>{statMode === "totals" ? formatNumber(stats?.fga_total) : formatNumber(stats?.fga_avg)}</td>
                                            <td>{statMode === "totals" ? formatNumber(stats?.ftm_total) : formatNumber(stats?.ftm_avg)}</td>
                                            <td>{statMode === "totals" ? formatNumber(stats?.fta_total) : formatNumber(stats?.fta_avg)}</td>
                                            <td>{statMode === "totals" ? formatNumber(stats?.fg3m_total) : formatNumber(stats?.fg3m_avg)}</td>
                                            <td>{statMode === "totals" ? formatNumber(stats?.reb_total) : formatNumber(stats?.reb_avg)}</td>
                                            <td>{statMode === "totals" ? formatNumber(stats?.ast_total) : formatNumber(stats?.ast_avg)}</td>
                                            <td>{statMode === "totals" ? formatNumber(stats?.stl_total) : formatNumber(stats?.stl_avg)}</td>
                                            <td>{statMode === "totals" ? formatNumber(stats?.blk_total) : formatNumber(stats?.blk_avg)}</td>
                                            <td>{statMode === "totals" ? formatNumber(stats?.tov_total) : formatNumber(stats?.tov_avg)}</td>
                                            <td>{statMode === "totals" ? formatNumber(stats?.pts_total) : formatNumber(stats?.pts_avg)}</td>
                                            <td>{adpFromRosterPercent(player.roster_percent)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="draft-pagination-row">
                        <button
                            type="button"
                            onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                            disabled={currentPage === 1 || loadingPlayers}
                        >
                            Previous
                        </button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
                            disabled={currentPage >= totalPages || loadingPlayers}
                        >
                            Next
                        </button>
                    </div>
                        </>
                    ) : activeTab === "pick-history" ? (
                        <section className="draft-history-panel">
                            <div className="draft-history-toolbar">
                                <span>{pickHistory.length} Picks</span>
                                <select
                                    value={historyRoundFilter}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setHistoryRoundFilter(value === "all" ? "all" : parseInt(value, 10));
                                    }}
                                >
                                    <option value="all">All Rounds</option>
                                    {historyRounds.map((round) => (
                                        <option key={round} value={round}>Round {round}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="draft-history-scroll">
                                {pickHistoryByRound.length === 0 ? (
                                    <div className="draft-table-status">No picks yet.</div>
                                ) : (
                                    pickHistoryByRound.map(({ round, picks }) => (
                                        <section key={round} className="draft-history-round-block">
                                            <h3>Round {round}</h3>
                                            <table className="draft-history-table">
                                                <thead>
                                                    <tr>
                                                        <th>PICK</th>
                                                        <th>PLAYER</th>
                                                        <th>TEAM</th>
                                                        <th>2025 PTS</th>
                                                        <th>PROJ PTS</th>
                                                        <th>RK</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {picks.map((pick) => {
                                                        const teamName = teamOrder.find((team) => team.id === pick.teamId)?.name ?? "Team";
                                                        const stats = pick.player.current_stats;
                                                        const projectedPoints = stats?.fantasy_points_avg != null
                                                            ? stats.fantasy_points_avg * 82
                                                            : null;

                                                        return (
                                                            <tr key={pick.overallPick}>
                                                                <td>{pick.overallPick}</td>
                                                                <td className="draft-history-player-cell">
                                                                    <PlayerImage
                                                                        playerId={pick.player.player_id}
                                                                        playerName={pick.player.full_name}
                                                                        size={34}
                                                                    />
                                                                    <div>
                                                                        <strong>{pick.player.full_name}</strong>
                                                                        <span>
                                                                            {pick.player.team_abbreviation ?? "FA"}
                                                                            {" "}
                                                                            {pick.player.position ?? "-"}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td>{teamName}</td>
                                                                <td>{formatInteger(stats?.fantasy_points_total)}</td>
                                                                <td>{projectedPoints == null ? "-" : formatInteger(projectedPoints)}</td>
                                                                <td>{adpFromRosterPercent(pick.player.roster_percent)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </section>
                                    ))
                                )}
                            </div>
                        </section>
                    ) : activeTab === "board" ? (
                        <section className="draft-board-panel">
                            <div className="draft-board-toolbar">
                                <div className="draft-board-view-toggle">
                                    <button
                                        type="button"
                                        className={boardViewMode === "round" ? "active" : ""}
                                        onClick={() => setBoardViewMode("round")}
                                    >
                                        <span className="draft-board-view-dot" aria-hidden="true"></span>
                                        Round View
                                    </button>
                                    <button
                                        type="button"
                                        className={boardViewMode === "roster" ? "active" : ""}
                                        onClick={() => setBoardViewMode("roster")}
                                    >
                                        <span className="draft-board-view-dot" aria-hidden="true"></span>
                                        Roster View
                                    </button>
                                </div>
                                {boardViewMode === "round" ? (
                                    <select
                                        value={boardRoundFilter}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setBoardRoundFilter(value === "all" ? "all" : parseInt(value, 10));
                                        }}
                                    >
                                        <option value="all">All Rounds</option>
                                        {historyRounds.map((round) => (
                                            <option key={round} value={round}>Round {round}</option>
                                        ))}
                                    </select>
                                ) : null}
                            </div>
                            <div className="draft-board-scroll">
                                {boardViewMode === "round" ? (
                                    <div className="draft-board-grid-wrap">
                                        <div
                                            className="draft-board-team-header-row"
                                            style={{ gridTemplateColumns: `repeat(${Math.max(1, boardTeamColumns.length)}, minmax(130px, 1fr))` }}
                                        >
                                            {boardTeamColumns.map((team) => (
                                                <div key={team.id} className="draft-board-team-header-cell">{team.name}</div>
                                            ))}
                                        </div>
                                        {boardVisibleRounds.map((round) => (
                                            <div
                                                key={round}
                                                className="draft-board-round-row"
                                                style={{ gridTemplateColumns: `repeat(${Math.max(1, boardTeamColumns.length)}, minmax(130px, 1fr))` }}
                                            >
                                                {boardTeamColumns.map((team) => {
                                                    const pick = pickHistory.find((entry) => entry.round === round && entry.teamId === team.id);
                                                    const pickPositionParts = pick ? getPositionParts(pick.player.position) : [];
                                                    const toneClass = pick ? getBoardToneClass(pick.player.position) : "";

                                                    return (
                                                        <div key={`${round}-${team.id}`} className={`draft-board-pick-card ${pick ? "has-pick" : "empty"} ${toneClass}`}>
                                                            {pick ? (
                                                                <>
                                                                    <small>{round}.{pick.roundPick}</small>
                                                                    <strong>{pick.player.full_name}</strong>
                                                                    <span>
                                                                        {pick.player.team_abbreviation ?? "FA"}
                                                                    </span>
                                                                    <span className="draft-board-position-tabs">
                                                                        {pickPositionParts.map((positionPart, positionIndex) => (
                                                                            <span
                                                                                key={`${pick.overallPick}-${positionPart}-${positionIndex}`}
                                                                                className={`draft-position-tab draft-position-${positionPart}`}
                                                                            >
                                                                                {positionPart}
                                                                            </span>
                                                                        ))}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="draft-board-empty-label">-</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="draft-board-grid-wrap">
                                        <div
                                            className="draft-board-team-header-row"
                                            style={{ gridTemplateColumns: `repeat(${Math.max(1, boardTeamColumns.length)}, minmax(130px, 1fr))` }}
                                        >
                                            {boardTeamColumns.map((team) => (
                                                <div key={team.id} className="draft-board-team-header-cell">{team.name}</div>
                                            ))}
                                        </div>
                                        {rosterSlots.map((slot, slotIndex) => (
                                            <div
                                                key={`${slot}-${slotIndex}`}
                                                className="draft-board-round-row"
                                                style={{ gridTemplateColumns: `repeat(${Math.max(1, boardTeamColumns.length)}, minmax(130px, 1fr))` }}
                                            >
                                                {boardTeamColumns.map((team) => {
                                                    const rosterPlayer = rosters[team.id]?.[slotIndex] ?? null;
                                                    const rosterPositionParts = rosterPlayer ? getPositionParts(rosterPlayer.position) : [];
                                                    const toneClass = rosterPlayer ? getBoardToneClass(rosterPlayer.position) : "";
                                                    return (
                                                        <div key={`${team.id}-${slot}-${slotIndex}`} className={`draft-board-pick-card ${rosterPlayer ? "has-pick" : "empty"} ${toneClass}`}>
                                                            {rosterPlayer ? (
                                                                <>
                                                                    <small>{slot}</small>
                                                                    <strong>{rosterPlayer.full_name}</strong>
                                                                    <span>
                                                                        {rosterPlayer.team_abbreviation ?? "FA"}
                                                                    </span>
                                                                    <span className="draft-board-position-tabs">
                                                                        {rosterPositionParts.map((positionPart, positionIndex) => (
                                                                            <span
                                                                                key={`${team.id}-${slot}-${slotIndex}-${positionPart}-${positionIndex}`}
                                                                                className={`draft-position-tab draft-position-${positionPart}`}
                                                                            >
                                                                                {positionPart}
                                                                            </span>
                                                                        ))}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <small>{slot}</small>
                                                                    <span className="draft-board-empty-label">Empty</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                    ) : activeTab === "rules" ? (
                        <section className="draft-rules-panel">
                            <div className="draft-rules-scroll">
                                <div className="draft-rules-section">
                                    <div className="draft-rules-section-title">Basic Settings</div>
                                    <div className="draft-rules-card">
                                        {[
                                            { label: "League Manager", value: leagueManagerName },
                                            { label: "League Name", value: leagueData?.name ?? "-" },
                                            { label: "Scoring Type", value: "Head to Head Points" },
                                            { label: "Teams in League", value: String(leagueData?.members.length ?? "-") },
                                        ].map((row, i) => (
                                            <div key={row.label} className={`draft-rules-row${i % 2 === 1 ? " alt" : ""}`}>
                                                <span className="draft-rules-label">{row.label}</span>
                                                <span className="draft-rules-value">{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="draft-rules-section">
                                    <div className="draft-rules-section-title">Draft Settings</div>
                                    <div className="draft-rules-card">
                                        {[
                                            { label: "Draft Type", value: draftSettings?.draft_type ?? "-" },
                                            { label: "Draft Order", value: draftSettings?.draft_order === "RANDOM" ? "Randomized" : "Custom" },
                                            { label: "Pick Clock", value: draftSettings != null ? `${draftSettings.time_per_pick}s` : "-" },
                                            { label: "Scheduled Date", value: draftSettings?.scheduled_date ? new Date(draftSettings.scheduled_date).toLocaleString() : "TBD" },
                                        ].map((row, i) => (
                                            <div key={row.label} className={`draft-rules-row${i % 2 === 1 ? " alt" : ""}`}>
                                                <span className="draft-rules-label">{row.label}</span>
                                                <span className="draft-rules-value">{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="draft-rules-section">
                                    <div className="draft-rules-section-title">Roster</div>
                                    <div className="draft-rules-card">
                                        {rulesRosterRows.map((row, i) => (
                                            <div key={row.slot} className={`draft-rules-row${i % 2 === 1 ? " alt" : ""}`}>
                                                <span className="draft-rules-label">{row.label}</span>
                                                <span className="draft-rules-value">{row.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section className="draft-lm-panel">
                            <div className="draft-lm-scroll">
                                <div className="draft-lm-controls-card">
                                    <div className="draft-lm-control-row">
                                        <span className="draft-lm-control-label">Pause the draft to enable all of the League Manager functions</span>
                                        <button
                                            type="button"
                                            className={`draft-lm-pause-btn${isDraftPaused ? " active" : ""}`}
                                            onClick={() => {
                                                const next = !isDraftPaused;
                                                setIsDraftPaused(next);
                                                localStorage.setItem(draftPauseKey, String(next));
                                                window.dispatchEvent(new CustomEvent("draft-pause-changed", { detail: { paused: next, key: draftPauseKey } }));
                                            }}
                                        >
                                            {isDraftPaused ? "RESUME" : "PAUSE"}
                                        </button>
                                    </div>
                                    <div className={`draft-lm-control-row alt${leagueManagerLocked ? " locked" : ""}`}>
                                        <span className="draft-lm-control-label">Allow managers that have disconnected to remain off autopick until the time allowed for their pick has expired</span>
                                        <span className="draft-lm-coming-soon">—</span>
                                    </div>
                                    <div className={`draft-lm-control-row${leagueManagerLocked ? " locked" : ""}`}>
                                        <span className="draft-lm-control-label">Configure the amount of time to make a pick</span>
                                        <select
                                            className="draft-lm-timer-select"
                                            disabled={leagueManagerLocked}
                                            value={pickTimerSeconds}
                                            onChange={(e) => {
                                                if (leagueManagerLocked) {
                                                    return;
                                                }
                                                const val = parseInt(e.target.value, 10);
                                                setPickTimerSeconds(val);
                                                setTimerSeconds(val);
                                            }}
                                        >
                                            {[30, 60, 90, 120, 180].map((s) => (
                                                <option key={s} value={s}>{s} SECONDS</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className={`draft-lm-control-row alt${leagueManagerLocked ? " locked" : ""}`}>
                                        <span className="draft-lm-control-label">Make draft picks for other players</span>
                                        <button
                                            type="button"
                                            className={`draft-lm-toggle${commissionerPickMode ? " on" : ""}`}
                                            disabled={leagueManagerLocked}
                                            onClick={() => setCommissionerPickMode((p) => !p)}
                                        >
                                            <span className="draft-lm-toggle-knob" />
                                        </button>
                                    </div>
                                </div>

                                <div className="draft-lm-section-title">Pick History</div>
                                <table className="draft-lm-history-table">
                                    <thead>
                                        <tr>
                                            <th>PICK</th>
                                            <th>PLAYER</th>
                                            <th>TEAM</th>
                                            <th>2025 PTS</th>
                                            <th>PROJ PTS</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pickHistory.length === 0 ? (
                                            <tr><td colSpan={6} className="draft-lm-empty">No picks yet.</td></tr>
                                        ) : (
                                            [...pickHistory].reverse().map((pick) => {
                                                const teamName = teamOrder.find((t) => t.id === pick.teamId)?.name ?? "Team";
                                                const stats = pick.player.current_stats;
                                                const proj = stats?.fantasy_points_avg != null ? Math.round(stats.fantasy_points_avg * 82) : null;
                                                const isLatest = pick.overallPick === pickHistory.length;
                                                return (
                                                    <tr key={pick.overallPick}>
                                                        <td className="draft-lm-pick-num">{pick.overallPick}</td>
                                                        <td className="draft-lm-player-cell">
                                                            <PlayerImage playerId={pick.player.player_id} playerName={pick.player.full_name} size={34} />
                                                            <div>
                                                                <strong>{pick.player.full_name}</strong>
                                                                <span>{pick.player.team_abbreviation ?? "FA"} {pick.player.position ?? "-"}</span>
                                                            </div>
                                                        </td>
                                                        <td>{teamName}</td>
                                                        <td>{stats?.fantasy_points_total != null ? Math.round(stats.fantasy_points_total) : "-"}</td>
                                                        <td>{proj ?? "-"}</td>
                                                        <td>
                                                            <button
                                                                type="button"
                                                                className="draft-lm-undo-btn"
                                                                disabled={leagueManagerLocked || !isLatest}
                                                                onClick={() => undoPick(pick.overallPick)}
                                                            >
                                                                UNDO
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}
                </main>

                <aside className="draft-right-rail">
                    <div className="draft-activity-header">Activity</div>
                    <div className="draft-activity-filters">
                        <button
                            type="button"
                            className={activityFilter === "all" ? "active" : ""}
                            onClick={() => setActivityFilter("all")}
                        >
                            <span className="draft-activity-filter-dot" aria-hidden="true"></span>
                            All
                        </button>
                        <button
                            type="button"
                            className={activityFilter === "messages" ? "active" : ""}
                            onClick={() => setActivityFilter("messages")}
                        >
                            <span className="draft-activity-filter-dot" aria-hidden="true"></span>
                            Messages
                        </button>
                        <button
                            type="button"
                            className={activityFilter === "picks" ? "active" : ""}
                            onClick={() => setActivityFilter("picks")}
                        >
                            <span className="draft-activity-filter-dot" aria-hidden="true"></span>
                            Picks
                        </button>
                    </div>
                    <ul>
                        {filteredActivity.length === 0 ? (
                            <li>No activity yet.</li>
                        ) : (
                            filteredActivity.map((entry) => {
                                const teamName = teamOrder.find((team) => team.id === entry.teamId)?.name ?? "Team";
                                return (
                                    <li key={entry.id} className="draft-activity-item">
                                        {entry.type === "pick" ? (
                                            <>
                                                <span className="draft-activity-item-image">
                                                    {entry.playerId ? (
                                                        <PlayerImage
                                                            playerId={entry.playerId}
                                                            playerName={entry.playerName ?? "Player"}
                                                            size={36}
                                                        />
                                                    ) : null}
                                                </span>
                                                <div className="draft-activity-item-text">
                                                    <strong>
                                                        {(entry.playerName ?? "Unknown Player")} / {entry.playerTeam ?? "FA"} {entry.playerPosition ?? "-"}
                                                    </strong>
                                                    <span>
                                                        R{entry.round ?? "-"}, P{entry.roundPick ?? "-"} - {teamName}
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="draft-activity-item-text draft-activity-item-text-message">
                                                <strong>{teamName}</strong>
                                                <span>{entry.text}</span>
                                            </div>
                                        )}
                                    </li>
                                );
                            })
                        )}
                    </ul>
                    <div className="draft-activity-message-bar">
                        <input
                            type="text"
                            value={activityMessage}
                            placeholder="Message Your League"
                            aria-label="Message your league"
                            onChange={(event) => setActivityMessage(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    handleSendMessage();
                                }
                            }}
                        />
                        <button type="button" onClick={handleSendMessage}>SEND</button>
                    </div>
                </aside>
            </div>

                    {draftComplete ? (
                        <div className="draft-complete-overlay" role="dialog" aria-modal="true" aria-label="Draft complete summary">
                            <section className="draft-complete-modal">
                                <header className="draft-complete-header">
                                    <p>Your draft is complete!</p>
                                    <h3>{ourTeamName.toUpperCase()}</h3>
                                </header>

                                <div className="draft-complete-list-wrap">
                                    {draftedRosterRows.length === 0 ? (
                                        <div className="draft-complete-empty">No drafted players found.</div>
                                    ) : (
                                        <ul className="draft-complete-list">
                                            {draftedRosterRows.map(({ slot, player }) => (
                                                <li key={`${slot}-${player?.id}`} className="draft-complete-player-row">
                                                    <span className="draft-complete-player-image">
                                                        {player ? (
                                                            <PlayerImage
                                                                playerId={player.player_id}
                                                                playerName={player.full_name}
                                                                size={42}
                                                            />
                                                        ) : null}
                                                    </span>
                                                    <div className="draft-complete-player-meta">
                                                        <strong>{player?.full_name ?? "-"}</strong>
                                                        <span>{player?.team_abbreviation ?? "FA"}</span>
                                                    </div>
                                                    <span className="draft-complete-player-slot">{slot}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <footer className="draft-complete-footer">
                                    <button
                                        type="button"
                                        className="draft-complete-cta"
                                        onClick={() => navigate(`/league/${currentLeagueId}/my-team`)}
                                    >
                                        Go to My Team
                                    </button>
                                </footer>
                            </section>
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );
}
