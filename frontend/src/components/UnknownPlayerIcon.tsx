export default function UnknownPlayerIcon() {
    return (
        <svg
            width="40"
            height="40"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "inline-block", borderRadius: "50%" }}
        >
            {/* Background circle */}
            <circle cx="16" cy="16" r="16" fill="#000000" />

            {/* Question mark */}
            <text
                x="16"
                y="22"
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="20"
                fontWeight="bold"
                fontFamily="Arial, sans-serif"
            >
                ?
            </text>
        </svg>
    );
}
