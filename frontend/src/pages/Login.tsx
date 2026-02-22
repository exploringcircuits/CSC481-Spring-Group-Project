import { Link, useNavigate } from "react-router-dom";
import "../styles/Auth.css";

export default function Login() {
    const navigate = useNavigate();

    return (
        <div>
            <h2 className="login-heading">Account Login</h2>
            <div className="login-box">
                <input
                    type="text"
                    placeholder="Email or Username"
                    className="login-input"
                />
                <input
                    type="password"
                    placeholder="Password"
                    className="login-input"
                />
                <Link to="/signup" className="signup-link">
                    Don't have an account?
                </Link>
                <button
                    className="continue-button"
                    onClick={() => navigate("/home")}
                >
                    Continue
                </button>
            </div>
        </div>
    );
}
