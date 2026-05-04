import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Auth.css";

export default function SignUp() {
    const navigate = useNavigate();
    
    // Set up state to hold our form data
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        retype_password: ""
    });

    // Update state whenever the user types
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    // Intercept the form submission to send to the Django backend
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); 

        try {
            // The route to the Django backend API
            const response = await fetch("http://localhost:8000/api/register/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                // Success! Now we route the user to the login page
                navigate("/login");
            } else {
                const errorData = await response.json();
                console.error("Backend validation failed:", errorData);
            }
        } catch (error) {
            console.error("Network error, is the Django server running?", error);
        }
    };

    return (
        <div>
            <h2 className="login-heading">Account Creation</h2>
            <form className="login-box" onSubmit={handleSubmit}>
                <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    className="login-input"
                    value={formData.username}
                    onChange={handleChange}
                    required
                />
                <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    className="login-input"
                    value={formData.email}
                    onChange={handleChange}
                    required
                />
                <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    className="login-input"
                    value={formData.password}
                    onChange={handleChange}
                    required
                />
                <input
                    type="password"
                    name="retype_password"
                    placeholder="Retype Password"
                    className="login-input"
                    value={formData.retype_password}
                    onChange={handleChange}
                    required
                />
                <Link to="/login" className="signup-link">
                    Already have an account?
                </Link>
                <button type="submit" className="continue-button">
                    Register
                </button>
            </form>
        </div>
    );
}