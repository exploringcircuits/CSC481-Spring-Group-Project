import React, { useRef, useEffect, useState } from "react";
import "../../styles/shared/Dropdown.css";

export interface DropdownProps {
    label: string;
    options: string[];
    selected: string;
    onSelect: (option: string) => void;
    disabled?: boolean;
    title?: string;
}

const Dropdown: React.FC<DropdownProps> = ({
    label,
    options,
    selected,
    onSelect,
    disabled = false,
    title,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const sectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                sectionRef.current &&
                !sectionRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div
            className="dropdown-section"
            ref={sectionRef}
            style={disabled ? { opacity: 0.5, pointerEvents: "none" } : {}}
            title={title}
        >
            <span className="dropdown-label">{label}</span>
            <div className="dropdown">
                <button
                    className="dropdown-button"
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={disabled}
                >
                    {selected}
                    <svg
                        className="dropdown-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                    >
                        <path d="M8 11L3 6h10z" />
                    </svg>
                </button>
                {isOpen && (
                    <div className="dropdown-menu">
                        {options.map((option) => (
                            <button
                                key={option}
                                className={`dropdown-item ${
                                    selected === option ? "active" : ""
                                }`}
                                onClick={() => {
                                    onSelect(option);
                                    setIsOpen(false);
                                }}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dropdown;
