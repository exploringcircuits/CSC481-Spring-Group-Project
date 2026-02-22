interface PlayerDataRowProps {
    playerId: number;
    playerName: string;
    team: string;
    position: string;
    type: string;
    action: string;
    opp: string;
    status: string;
    min: string;
    fgm: string;
    fga: string;
    ftm: string;
    fta: string;
    threepm: string;
    reb: string;
    ast: string;
    stl: string;
    blk: string;
    to: string;
    pts: string;
    rostPercent: string;
    plusMinus: string;
    tot: string;
    avg: string;
}

import PlayerImage from "./PlayerImage";

// Helper function to get injury status indicator
function getInjuryIndicator(
    status: string,
): { text: string; color: string } | null {
    if (!status) return null;

    const statusLower = status.toLowerCase();

    // Don't show anything for healthy/probable players
    if (statusLower.includes("probable") || statusLower === "p") {
        return null;
    }

    const RED = "#dc3545";

    // Out
    if (statusLower.includes("out")) {
        return { text: "O", color: RED };
    }
    // Day-to-Day
    if (
        statusLower.includes("day to day") ||
        statusLower.includes("day-to-day") ||
        statusLower === "dtd"
    ) {
        return { text: "DTD", color: RED };
    }
    // Questionable
    if (statusLower.includes("questionable") || statusLower === "q") {
        return { text: "Q", color: RED };
    }
    // Doubtful
    if (statusLower.includes("doubtful") || statusLower === "d") {
        return { text: "D", color: RED };
    }
    // Injured Reserve / IR
    if (statusLower.includes("injured reserve") || statusLower === "ir") {
        return { text: "IR", color: RED };
    }
    // Not Available (NA)
    if (statusLower === "na" || statusLower.includes("not available")) {
        return { text: "NA", color: RED };
    }

    return null;
}

export default function PlayerDataRow({
    playerId,
    playerName,
    team,
    position,
    type,
    action: _action,
    opp,
    status,
    min,
    fgm,
    fga,
    ftm,
    fta,
    threepm,
    reb,
    ast,
    stl,
    blk,
    to,
    pts,
    rostPercent,
    plusMinus,
    tot,
    avg,
}: PlayerDataRowProps) {
    return (
        <div className="table-row">
            <div
                className="table-cell"
                style={{ gap: "0.5rem", display: "flex", alignItems: "center" }}
            >
                <PlayerImage playerId={playerId} playerName={playerName} />
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                        }}
                    >
                        <span
                            style={{
                                color: "#38b6ff",
                                textDecoration: "underline",
                                cursor: "pointer",
                                fontWeight: "normal",
                            }}
                        >
                            {playerName || "Player Name"}
                        </span>
                        {(() => {
                            const indicator = getInjuryIndicator(status);
                            if (indicator) {
                                return (
                                    <span
                                        style={{
                                            color: indicator.color,
                                            fontWeight: "normal",
                                            fontSize: "0.75rem",
                                        }}
                                    >
                                        {indicator.text}
                                    </span>
                                );
                            }
                            return null;
                        })()}
                    </div>
                    <span
                        style={{
                            fontWeight: "normal",
                            fontSize: "0.65rem",
                            color: "#000000",
                            display: "flex",
                            gap: "0.5rem",
                        }}
                    >
                        <span>{team || "Team"}</span>
                        <span style={{ fontWeight: "bold" }}>
                            {position || "POS"}
                        </span>
                    </span>
                </div>
            </div>
            <div className="table-cell" style={{ fontWeight: "normal" }}>
                {type}
            </div>
            <div
                className="table-cell"
                style={{ gap: "0.5rem", justifyContent: "center" }}
            >
                <button
                    style={{
                        background: "#28a745",
                        border: "none",
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        color: "white",
                        fontSize: "16px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    +
                </button>
                <button
                    style={{
                        background: "#000000",
                        border: "none",
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        color: "white",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        padding: "0",
                        flexShrink: 0,
                    }}
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="white"
                        style={{ margin: "0" }}
                    >
                        <path d="M4 15.5C4 15.5 5 14.5 8 14.5C11 14.5 13 16.5 16 16.5C19 16.5 20 15.5 20 15.5V3.5C20 3.5 19 4.5 16 4.5C13 4.5 11 2.5 8 2.5C5 2.5 4 3.5 4 3.5V15.5ZM4 15.5V22" />
                    </svg>
                </button>
            </div>
            <div className="table-cell" style={{ opacity: 0.5 }}>
                {opp}
            </div>
            <div className="table-cell" style={{ opacity: 0.5 }}>
                {status}
            </div>
            <div className="table-cell">{min}</div>
            <div className="table-cell">{fgm}</div>
            <div className="table-cell">{fga}</div>
            <div className="table-cell">{ftm}</div>
            <div className="table-cell">{fta}</div>
            <div className="table-cell">{threepm}</div>
            <div className="table-cell">{reb}</div>
            <div className="table-cell">{ast}</div>
            <div className="table-cell">{stl}</div>
            <div className="table-cell">{blk}</div>
            <div className="table-cell">{to}</div>
            <div className="table-cell">{pts}</div>
            <div className="table-cell">{rostPercent}</div>
            <div className="table-cell">{plusMinus}</div>
            <div className="table-cell">{tot}</div>
            <div className="table-cell">{avg}</div>
        </div>
    );
}
