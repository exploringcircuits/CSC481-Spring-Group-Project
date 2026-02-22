import React from "react";
import "../../styles/shared/Toggle.css";

export interface ToggleProps {
    label?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({
    label,
    checked,
    onChange,
    disabled = false,
}) => {
    const handleToggle = () => {
        if (!disabled) {
            onChange(!checked);
        }
    };

    return (
        <div className="toggle-wrapper">
            {label && <span className="toggle-label">{label}</span>}
            <button
                className={`toggle-button ${checked ? "active" : ""}`}
                onClick={handleToggle}
                disabled={disabled}
                aria-pressed={checked}
            >
                <span className={`toggle-switch ${checked ? "on" : ""}`} />
            </button>
        </div>
    );
};

export default Toggle;
