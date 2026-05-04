import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Tabs from "../components/shared/Tabs";
import Button from "../components/shared/Button";
import Calendar from "../components/shared/Calendar";
import { fetchDraftSettings, updateDraftSettings, fetchLeague } from "../services/api";
import "../styles/DraftSettings.css";

interface Tab {
    id: string;
    label: string;
    disabled?: boolean;
}

const getDefaultDraftDateTime = () => {
    const defaultDateTime = new Date();
    defaultDateTime.setMinutes(defaultDateTime.getMinutes() + 10);

    const year = defaultDateTime.getFullYear();
    const month = String(defaultDateTime.getMonth() + 1).padStart(2, "0");
    const day = String(defaultDateTime.getDate()).padStart(2, "0");
    const hours = String(defaultDateTime.getHours()).padStart(2, "0");
    const minutes = String(defaultDateTime.getMinutes()).padStart(2, "0");

    return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`,
    };
};

export default function DraftSettingsPage() {
    const { leagueId: paramsLeagueId } = useParams();
    const navigate = useNavigate();
    const leagueId = paramsLeagueId ? parseInt(paramsLeagueId) : 0;
    const defaultDraftDateTime = getDefaultDraftDateTime();

    const [activeTab, setActiveTab] = useState("draft");
    const [scheduledDate, setScheduledDate] = useState<string>(defaultDraftDateTime.date);
    const [scheduledTime, setScheduledTime] = useState<string>(defaultDraftDateTime.time);
    const [timePerPick, setTimePerPick] = useState<number>(90);
    const [draftOrder, setDraftOrder] = useState<"RANDOM" | "CUSTOM">("RANDOM");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showError, setShowError] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [isLeagueFull, setIsLeagueFull] = useState(false);

    useEffect(() => {
        const loadDraftSettings = async () => {
            try {
                setLoading(true);
                const settings = await fetchDraftSettings(leagueId);
                const league = await fetchLeague(leagueId);
                const parsedDate = settings.scheduled_date
                    ? new Date(settings.scheduled_date)
                    : null;

                if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
                    const year = parsedDate.getFullYear();
                    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
                    const day = String(parsedDate.getDate()).padStart(2, "0");
                    const hours = String(parsedDate.getHours()).padStart(2, "0");
                    const minutes = String(parsedDate.getMinutes()).padStart(2, "0");

                    setScheduledDate(`${year}-${month}-${day}`);
                    setScheduledTime(`${hours}:${minutes}`);
                }

                setTimePerPick(settings.time_per_pick);
                setDraftOrder(settings.draft_order);
                setIsLeagueFull((league.members?.length ?? 0) >= (league.max_players ?? 0));
                setError(null);
                setShowError(false);
            } catch (err) {
                // Non-blocking: if initial fetch fails, keep sensible defaults.
                setError(null);
                setShowError(false);
                setIsLeagueFull(false);
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (leagueId > 0) {
            loadDraftSettings();
        }
    }, [leagueId]);

    const handleSaveDraftSettings = async () => {
        if (!scheduledDate) {
            setError("Select a draft date before saving.");
            setShowError(true);
            return;
        }

        if (!isLeagueFull) {
            setError("Draft cannot be scheduled until all league users have joined.");
            setShowError(true);
            return;
        }

        try {
            setSaving(true);
            setError(null);
            setShowError(false);
            setSuccessMessage(null);

            const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);

            const updated = await updateDraftSettings(leagueId, {
                scheduled_date: scheduledDateTime.toISOString(),
                time_per_pick: timePerPick,
                draft_order: draftOrder,
                draft_type: "SNAKE",
            });

            const parsedUpdatedDate = new Date(updated.scheduled_date);
            const year = parsedUpdatedDate.getFullYear();
            const month = String(parsedUpdatedDate.getMonth() + 1).padStart(2, "0");
            const day = String(parsedUpdatedDate.getDate()).padStart(2, "0");
            const hours = String(parsedUpdatedDate.getHours()).padStart(2, "0");
            const minutes = String(parsedUpdatedDate.getMinutes()).padStart(2, "0");

            setScheduledDate(`${year}-${month}-${day}`);
            setScheduledTime(`${hours}:${minutes}`);
            setSuccessMessage("Draft settings saved successfully.");

            navigate(`/league/${leagueId}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save draft settings";
            setError(message);
            setShowError(true);
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const tabs: Tab[] = [
        { id: "draft", label: "Draft" },
        { id: "summary", label: "Summary" },
        { id: "basic-settings", label: "Basic Settings" },
        { id: "rosters", label: "Rosters" },
        { id: "scoring", label: "Scoring" },
        { id: "teams-divisions", label: "Teams and Divisions" },
        { id: "transactions", label: "Transactions and Keepers" },
        { id: "schedule", label: "Schedule" },
    ];

    if (loading) {
        return (
            <div className="draft-settings-page">
                <div className="draft-settings-container">
                    <p>Loading draft settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="draft-settings-page">
            <h2 className="draft-settings-heading">League Settings</h2>
            <div className="draft-settings-container">
            <div className="draft-settings-content">
                <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

                {activeTab === "draft" && (
                    <div className="draft-settings-panel">
                        <div className="draft-settings-section">
                            <h3 className="section-title">Draft Type</h3>
                            <div className="draft-type-options">
                                <div className="draft-type-option">
                                    <input
                                        type="radio"
                                        id="snake-draft"
                                        name="draft-type"
                                        value="SNAKE"
                                        checked={true}
                                        disabled
                                    />
                                    <label htmlFor="snake-draft">
                                        <strong>Snake</strong>
                                        <p>
                                            Your league will participate in a live online draft with ESPN's live draft software. Based on a predetermined draft order, each team takes a turn selecting a player in a set amount of time. This type of draft is sometimes called a Snake Draft, as the draft order reverses each round.
                                        </p>
                                    </label>
                                </div>

                                <div className="draft-type-option disabled">
                                    <input type="radio" id="offline-draft" disabled />
                                    <label htmlFor="offline-draft">
                                        <strong>Offline</strong>
                                        <p>Your league conducts its own offline draft. You submit the results manually.</p>
                                    </label>
                                </div>

                                <div className="draft-type-option disabled">
                                    <input type="radio" id="autopick-draft" disabled />
                                    <label htmlFor="autopick-draft">
                                        <strong>Autopick</strong>
                                        <p>Your league's rosters are automatically drafted based on each team's pre-draft rankings list. Each team owner will receive an email upon the draft's completion.</p>
                                    </label>
                                </div>

                                <div className="draft-type-option disabled">
                                    <input type="radio" id="salary-cap-draft" disabled />
                                    <label htmlFor="salary-cap-draft">
                                        <strong>Salary Cap</strong>
                                        <p>Your league will participate in a live online salary cap draft. Teams begin with a set salary cap and take turns nominating players.</p>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="draft-settings-section">
                            <h3 className="section-title">Draft Settings</h3>

                            <div className="settings-grid">
                                <div className="setting-item">
                                    <label htmlFor="draft-date">Draft Date</label>
                                    <div className="draft-date-picker">
                                        <input
                                            id="draft-date"
                                            type="text"
                                            value={scheduledDate}
                                            placeholder={defaultDraftDateTime.date}
                                            readOnly
                                        />
                                    <Calendar
                                        onDateSelect={setScheduledDate}
                                        selectedDate={scheduledDate}
                                    />
                                    </div>
                                </div>

                                <div className="setting-item">
                                    <label htmlFor="draft-time">Draft Time</label>
                                    <input
                                        id="draft-time"
                                        type="time"
                                        value={scheduledTime}
                                        onChange={(e) => setScheduledTime(e.target.value)}
                                    />
                                </div>

                                <div className="setting-item">
                                    <label htmlFor="time-per-pick">Time Per Pick</label>
                                    <select
                                        id="time-per-pick"
                                        value={timePerPick}
                                        onChange={(e) => setTimePerPick(parseInt(e.target.value))}
                                        className="setting-select"
                                    >
                                        <option value={30}>30 seconds</option>
                                        <option value={45}>45 seconds</option>
                                        <option value={60}>1 minute</option>
                                        <option value={90}>90 seconds</option>
                                        <option value={120}>2 minutes</option>
                                        <option value={180}>3 minutes</option>
                                        <option value={300}>5 minutes</option>
                                        <option value={600}>10 minutes</option>
                                    </select>
                                </div>

                                <div className="setting-item">
                                    <label htmlFor="draft-order">Draft Order</label>
                                    <select
                                        id="draft-order"
                                        value={draftOrder}
                                        onChange={(e) => setDraftOrder(e.target.value as "RANDOM" | "CUSTOM")}
                                        className="setting-select"
                                    >
                                        <option value="RANDOM">Randomized One Hour Prior to Draft Time</option>
                                        <option value="CUSTOM">Custom Draft Order</option>
                                    </select>
                                </div>
                            </div>

                            {showError && error && <div className="error-message">{error}</div>}
                            {successMessage && <div className="success-message">{successMessage}</div>}

                            {!isLeagueFull && (
                                <div className="error-message">
                                    Draft scheduling is locked until the league is full.
                                </div>
                            )}

                            <div className="settings-buttons">
                                <Button
                                    variant="gradient"
                                    size="md"
                                    onClick={handleSaveDraftSettings}
                                    loading={saving}
                                    disabled={!isLeagueFull}
                                >
                                    Save Changes
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="md"
                                    onClick={() => navigate(`/league/${leagueId}`)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "summary" && (
                    <div className="draft-settings-panel">
                        <p>Summary Tab - Coming Soon</p>
                    </div>
                )}

                {activeTab !== "draft" && activeTab !== "summary" && (
                    <div className="draft-settings-panel">
                        <p>This section is not yet implemented.</p>
                    </div>
                )}
            </div>

            <button
                className="switch-league-button draft-settings-switch-league-button"
                onClick={() => navigate("/league-selection")}
            >
                Switch League
            </button>
        </div>
        </div>
    );
}
