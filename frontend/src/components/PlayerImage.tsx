import { useState } from "react";
import UnknownPlayerIcon from "./UnknownPlayerIcon";

interface PlayerImageProps {
    playerId: number;
    playerName: string;
    size?: number;
}

export default function PlayerImage({
    playerId,
    playerName,
    size = 40,
}: PlayerImageProps) {
    const [imageError, setImageError] = useState(false);

    // NBA CDN URL for player headshots
    const imageUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;

    if (imageError) {
        return <UnknownPlayerIcon size={size} />;
    }

    return (
        <img
            src={imageUrl}
            alt={playerName}
            onError={() => setImageError(true)}
            style={{
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: "50%",
                objectFit: "cover",
                backgroundColor: "#f0f0f0",
            }}
        />
    );
}
