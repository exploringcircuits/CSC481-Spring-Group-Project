import "../styles/LMNote.css";

export default function LMNote() {
    return (
        <section className="league-card league-card--wide">
            <div className="league-card-header">
                <span className="league-card-label">League Manager's Note</span>
                <a className="lmnote-edit-link">Edit LM Note</a>
            </div>
            <h2 className="lmnote-title">Fantasy Basketball 2026!</h2>
            <p className="lmnote-description">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                enim ad minim veniam, quis nostrud exercitation ullamco laboris.
            </p>
        </section>
    );
}
