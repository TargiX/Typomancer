import React, { useEffect, useState } from 'react';

export interface EmblemTileProps {
    src: string;
    fallback?: React.ReactNode;
    size: number;
    className?: string;
    style?: React.CSSProperties;
}

const EmblemTile: React.FC<EmblemTileProps> = ({ src, fallback, size, className = '', style }) => {
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        setImageFailed(false);
    }, [src]);

    if (imageFailed && fallback == null) return null;

    return (
        <span
            className={`screens-icon-tile screens-emblem-tile ${imageFailed ? 'screens-emblem-failed' : ''} ${className}`}
            style={{ width: size, height: size, ...style }}
            aria-hidden="true"
        >
            {imageFailed ? (
                <span className="screens-emblem-fallback">{fallback}</span>
            ) : (
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="screens-emblem-image"
                    onError={() => setImageFailed(true)}
                />
            )}
        </span>
    );
};

export default EmblemTile;
