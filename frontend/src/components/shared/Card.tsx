import React from "react";
import "../../styles/shared/Card.css";

export interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    subtitle?: string;
    actions?: React.ReactNode;
    elevated?: boolean;
    clickable?: boolean;
    onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
    children,
    className = "",
    title,
    subtitle,
    actions,
    elevated = true,
    clickable = false,
    onClick,
}) => {
    const cardClass = [
        "card",
        elevated && "card--elevated",
        clickable && "card--clickable",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            className={cardClass}
            onClick={onClick}
            role={clickable ? "button" : undefined}
        >
            {(title || subtitle) && (
                <div className="card-header">
                    <div className="card-title-group">
                        {title && <h3 className="card-title">{title}</h3>}
                        {subtitle && (
                            <p className="card-subtitle">{subtitle}</p>
                        )}
                    </div>
                    {actions && <div className="card-actions">{actions}</div>}
                </div>
            )}
            <div className="card-body">{children}</div>
        </div>
    );
};

export default Card;
