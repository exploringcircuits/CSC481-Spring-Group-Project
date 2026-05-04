import React, { type ButtonHTMLAttributes } from "react";
import "../../styles/shared/Button.css";

type ButtonVariant = "primary" | "secondary" | "gradient" | "outline";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    loading?: boolean;
    children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = "secondary",
            size = "md",
            fullWidth = false,
            loading = false,
            className = "",
            disabled,
            children,
            ...props
        },
        ref,
    ) => {
        const baseClass = "btn";
        const variantClass = `btn--${variant}`;
        const sizeClass = `btn--${size}`;
        const fullWidthClass = fullWidth ? "btn--full-width" : "";
        const disabledClass = disabled || loading ? "btn--disabled" : "";

        const classes = [
            baseClass,
            variantClass,
            sizeClass,
            fullWidthClass,
            disabledClass,
            className,
        ]
            .filter(Boolean)
            .join(" ");

        return (
            <button
                ref={ref}
                className={classes}
                disabled={disabled || loading}
                {...props}
            >
                {loading ? "Loading..." : children}
            </button>
        );
    },
);

Button.displayName = "Button";

export default Button;
