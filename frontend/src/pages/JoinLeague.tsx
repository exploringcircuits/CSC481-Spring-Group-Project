import { useNavigate } from "react-router-dom";
import "../styles/Auth.css";
import "../styles/CreateLeague.css";

export default function JoinLeague() {
    const navigate = useNavigate();

    return (
        <div>
            <h2 className="login-heading">Join a League</h2>
            <div className="login-box">
                <button
                    className="close-button"
                    onClick={() => navigate("/home")}
                >
                    ×
                </button>
                <input
                    type="text"
                    placeholder="League Invite Code"
                    className="login-input"
                />
                <a
                    href="#"
                    className="signup-link"
                    onClick={(e) => {
                        e.preventDefault();
                        navigate("/create-league");
                    }}
                >
                    Create a League instead?
                </a>
                <button className="continue-button">Join League</button>
            </div>
        </div>
    );
}
