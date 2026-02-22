import "../styles/LeagueHome.css";

import "../styles/LeagueInfoCard.css";

export default function LeagueInfoCard() {
    return (
        <section className="league-card league-card--wide">
            <div className="league-info-container">
                <div className="league-info-left">
                    <div className="league-name">League Name</div>
                    <div className="league-info-links">
                        <a href="#" className="league-info-link">
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
                        <span>Username</span>
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
                        <span>4</span>
                    </div>
                </div>
            </div>
            <div className="league-info-warning">
                Your league is not full yet and your draft has not been
                scheduled!
            </div>
            <div className="league-info-buttons">
                <button className="league-info-button">Invite Users</button>
                <button className="league-info-button">Schedule Draft</button>
            </div>
        </section>
    );
}
