import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Auth.css";
import "../styles/CreateLeague.css";

export default function CreateLeague() {
    const navigate = useNavigate();
    const [selectedTeams] = useState<number>(4);
    const [selectedScoring] = useState<string>("H2H Points");
    const teamOptions = [4, 6, 8, 10, 12, 14, 16, 18, 20];
    const scoringOptions = [
        "Roto",
        "H2H Points",
        "H2H Each Category",
        "H2H Most Categories",
        "Season Points",
    ];

    return (
        <div>
            <h2 className="login-heading">Create a League</h2>
            <div className="login-box">
                <button
                    className="close-button"
                    onClick={() => navigate("/home")}
                >
                    ×
                </button>
                <input
                    type="text"
                    placeholder="League Name"
                    className="login-input"
                />
                <label className="team-label">Number of Teams</label>
                <div className="team-buttons">
                    {teamOptions.map((teams) => (
                        <button
                            key={teams}
                            className={`team-button ${
                                selectedTeams === teams ? "selected" : ""
                            } ${teams !== 4 ? "disabled" : ""}`}
                            onClick={() => teams === 4 && null}
                            disabled={teams !== 4}
                        >
                            {teams}
                        </button>
                    ))}
                </div>
                <label className="team-label">Scoring</label>
                <div className="scoring-buttons">
                    {scoringOptions.map((scoring) => (
                        <button
                            key={scoring}
                            className={`scoring-button ${
                                selectedScoring === scoring ? "selected" : ""
                            } ${scoring !== "H2H Points" ? "disabled" : ""}`}
                            onClick={() => scoring === "H2H Points" && null}
                            disabled={scoring !== "H2H Points"}
                        >
                            {scoring}
                        </button>
                    ))}
                </div>
                <a
                    href="#"
                    className="signup-link"
                    onClick={(e) => {
                        e.preventDefault();
                        navigate("/join-league");
                    }}
                >
                    Join a League instead?
                </a>
                <button className="continue-button">Create League</button>
            </div>
        </div>
    );
}
