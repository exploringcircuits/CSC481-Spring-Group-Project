import { useState } from "react";
import UnknownPlayerIcon from "./UnknownPlayerIcon";

interface PlayerImageProps {
    playerId: number;
    playerName: string;
}

export default function PlayerImage({
    playerId,
    playerName,
}: PlayerImageProps) {
    const [imageError, setImageError] = useState(false);

    // NBA CDN URL for player headshots
    const imageUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;

    if (imageError) {
        return <UnknownPlayerIcon />;
    }

    return (
        <img
            src={imageUrl}
            alt={playerName}
            onError={() => setImageError(true)}
            style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                objectFit: "cover",
                backgroundColor: "#f0f0f0",
            }}
        />
    );
}
