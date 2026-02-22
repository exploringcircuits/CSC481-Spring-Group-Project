import React from "react";
import "../../styles/shared/SearchInput.css";

export interface SearchInputProps {
    label?: string;
    icon?: boolean;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
    (
        {
            label,
            icon = true,
            value,
            onChange,
            placeholder = "Search...",
            className = "",
            disabled = false,
        },
        ref,
    ) => {
        return (
            <div className={`search-input-container ${className}`.trim()}>
                {label && <label className="search-input-label">{label}</label>}
                <div className="search-input-wrapper">
                    {icon && (
                        <svg
                            className="search-input-icon"
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path d="M10.5 1a9.5 9.5 0 0 1 7.596 15.236l8.734 8.734a1.5 1.5 0 1 1-2.121 2.121l-8.734-8.734A9.5 9.5 0 1 1 10.5 1zm0 3a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" />
                        </svg>
                    )}
                    <input
                        ref={ref}
                        type="text"
                        className="search-input"
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={disabled}
                    />
                </div>
            </div>
        );
    },
);

SearchInput.displayName = "SearchInput";

export default SearchInput;
