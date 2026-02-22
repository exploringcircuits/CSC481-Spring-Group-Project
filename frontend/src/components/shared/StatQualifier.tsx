import React, { useRef, useEffect } from "react";
import { STAT_QUALIFIER_OPTIONS } from "../../constants/filterOptions";
import Dropdown from "./Dropdown";
import "../../styles/shared/StatQualifier.css";

export interface StatQualifierProps {
    selectedStat: string;
    selectedValue: number;
    onStatChange: (stat: string) => void;
    onValueChange: (value: number) => void;
    disabled?: boolean;
}

const StatQualifier: React.FC<StatQualifierProps> = ({
    selectedStat,
    selectedValue,
    onStatChange,
    onValueChange,
    disabled = false,
}) => {
    const sectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                sectionRef.current &&
                !sectionRef.current.contains(event.target as Node)
            ) {
                // Optionally close any opened dropdowns
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleStatChange = (stat: string) => {
        onStatChange(stat);
        onValueChange(0.0);
    };

    return (
        <div
            className="stat-qualifier-section"
            ref={sectionRef}
            style={disabled ? { opacity: 0.5, pointerEvents: "none" } : {}}
        >
            <span className="stat-qualifier-label">Stat Qualifier</span>
            <div className="stat-qualifier-controls">
                <Dropdown
                    label=""
                    options={STAT_QUALIFIER_OPTIONS}
                    selected={selectedStat}
                    onSelect={handleStatChange}
                    disabled={disabled}
                />
                <div
                    className={`stat-qualifier-slider-group ${
                        selectedStat === "Off" ? "disabled" : ""
                    }`}
                >
                    <span className="stat-qualifier-at-least-label">
                        At least
                    </span>
                    <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.1"
                        value={selectedValue}
                        onChange={(e) =>
                            onValueChange(parseFloat(e.target.value))
                        }
                        disabled={selectedStat === "Off"}
                        className="stat-qualifier-slider"
                    />
                    <span className="stat-qualifier-value">
                        {selectedValue.toFixed(1)}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default StatQualifier;
