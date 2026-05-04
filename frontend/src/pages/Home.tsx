import { useNavigate } from "react-router-dom";
import "../styles/Auth.css";
import "../styles/Home.css";

export default function Home() {
    const navigate = useNavigate();

    return (
        <div>
            <h2 className="login-heading">Lets Play!</h2>
            <div className="login-box">
                <a
                    href="#"
                    className="centered-link"
                    onClick={(e) => {
                        e.preventDefault();
                        navigate("/league-selection");
                    }}
                >
                    Already in a League?
                </a>
                <div className="button-container">
                    <button
                        className="league-button"
                        onClick={() => navigate("/join-league")}
                    >
                        Join a League
                    </button>
                    <button
                        className="league-button"
                        onClick={() => navigate("/create-league")}
                    >
                        Create a League
                    </button>
                </div>
            </div>
        </div>
    );
}
