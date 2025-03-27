import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';

// Styled components for iPod-like interface
const HolderDevice = styled.div`
    width: 300px;
    height: 500px;
    background: linear-gradient(145deg, #f0f0f0, #e6e6e6);
    border-radius: 30px;
    padding: 20px;
    box-shadow: 0 10px 20px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
`;

const Screen = styled.div`
    width: 260px;
    height: 200px;
    background: #000;
    border-radius: 10px;
    margin-bottom: 20px;
    overflow: hidden;
    position: relative;
`;

const MediaDisplay = styled.div<{ type: 'audio' | 'video' | 'image' }>`
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${props => props.type === 'audio' ? '#1a1a1a' : '#000'};
    color: #fff;
`;

const ControlWheel = styled.div`
    width: 200px;
    height: 200px;
    background: #e6e6e6;
    border-radius: 50%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const CenterButton = styled.button`
    width: 60px;
    height: 60px;
    background: #f0f0f0;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    &:hover {
        background: #e0e0e0;
    }
`;

const NavigationButton = styled.button`
    width: 40px;
    height: 40px;
    background: #f0f0f0;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    &:hover {
        background: #e0e0e0;
    }
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const PrevButton = styled(NavigationButton)`
    left: 20px;
    top: 50%;
    transform: translateY(-50%);
`;

const NextButton = styled(NavigationButton)`
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
`;

const ShuffleButton = styled(NavigationButton)`
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${props => props.isShuffled ? '#1DB954' : '#f0f0f0'};
    color: ${props => props.isShuffled ? '#fff' : '#000'};
`;

const ProgressBar = styled.div`
    width: 90%;
    height: 4px;
    background: #333;
    border-radius: 2px;
    position: absolute;
    bottom: 30px;
    left: 5%;
`;

const Progress = styled.div<{ width: number }>`
    width: ${props => props.width}%;
    height: 100%;
    background: #1DB954;
    border-radius: 2px;
    transition: width 0.1s linear;
`;

const Title = styled.div`
    color: #fff;
    font-size: 14px;
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const CrystalCounter = styled.div`
    color: #fff;
    font-size: 12px;
    position: absolute;
    bottom: 10px;
    left: 10px;
    right: 10px;
    text-align: center;
`;

interface Props {
    type: 'audio' | 'video' | 'image';
    title: string;
    src: string;
    onPlay?: () => void;
    onPause?: () => void;
    onNext?: () => void;
    onPrevious?: () => void;
    onShuffle?: () => void;
    isShuffled?: boolean;
    totalCrystals?: number;
    currentIndex?: number;
}

export const CrystalHolderViewer: React.FC<Props> = ({
    type,
    title,
    src,
    onPlay,
    onPause,
    onNext,
    onPrevious,
    onShuffle,
    isShuffled = false,
    totalCrystals = 1,
    currentIndex = 1
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);

    useEffect(() => {
        if (mediaRef.current) {
            mediaRef.current.addEventListener('timeupdate', () => {
                const media = mediaRef.current;
                if (media) {
                    setProgress((media.currentTime / media.duration) * 100);
                }
            });
        }
    }, []);

    const togglePlayPause = () => {
        if (mediaRef.current) {
            if (isPlaying) {
                mediaRef.current.pause();
                onPause?.();
            } else {
                mediaRef.current.play();
                onPlay?.();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const renderMedia = () => {
        switch (type) {
            case 'video':
                return (
                    <video
                        ref={mediaRef as React.RefObject<HTMLVideoElement>}
                        src={src}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                );
            case 'audio':
                return (
                    <>
                        <audio
                            ref={mediaRef as React.RefObject<HTMLAudioElement>}
                            src={src}
                        />
                        <div style={{ fontSize: 40 }}>🎵</div>
                    </>
                );
            case 'image':
                return (
                    <img
                        src={src}
                        alt={title}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                );
        }
    };

    return (
        <HolderDevice>
            <Screen>
                <Title>{title}</Title>
                <MediaDisplay type={type}>
                    {renderMedia()}
                </MediaDisplay>
                {type !== 'image' && (
                    <ProgressBar>
                        <Progress width={progress} />
                    </ProgressBar>
                )}
                <CrystalCounter>
                    Crystal {currentIndex} of {totalCrystals}
                    {isShuffled && ' (Shuffled)'}
                </CrystalCounter>
            </Screen>
            <ControlWheel>
                <PrevButton onClick={onPrevious} disabled={totalCrystals <= 1}>
                    ⬅️
                </PrevButton>
                <CenterButton onClick={togglePlayPause}>
                    {isPlaying ? '⏸️' : '▶️'}
                </CenterButton>
                <NextButton onClick={onNext} disabled={totalCrystals <= 1}>
                    ➡️
                </NextButton>
                <ShuffleButton onClick={onShuffle} isShuffled={isShuffled}>
                    🔀
                </ShuffleButton>
            </ControlWheel>
        </HolderDevice>
    );
}; 