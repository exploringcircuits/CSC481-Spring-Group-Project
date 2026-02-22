import { Link, useNavigate } from "react-router-dom";
import "../styles/Auth.css";

export default function SignUp() {
    const navigate = useNavigate();

    return (
        <div>
            <h2 className="login-heading">Account Creation</h2>
            <div className="login-box">
                <input
                    type="text"
                    placeholder="Username"
                    className="login-input"
                />
                <input
                    type="email"
                    placeholder="Email"
                    className="login-input"
                />
                <input
                    type="password"
                    placeholder="Password"
                    className="login-input"
                />
                <input
                    type="password"
                    placeholder="Retype Password"
                    className="login-input"
                />
                <Link to="/login" className="signup-link">
                    Already have an account?
                </Link>
                <button
                    className="continue-button"
                    onClick={() => navigate("/login")}
                >
                    Register
                </button>
            </div>
        </div>
    );
}
