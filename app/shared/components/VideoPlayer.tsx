import { useEffect, useRef } from "preact/hooks";
import { get, set } from "../utils/idb.ts";
import { STORES } from "../utils/idb.ts";

interface VideoPlayerProps {
  options: any;
  onReady?: (player: any) => void;
  src: string;
}

export function VideoPlayer({ options, onReady, src }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!playerRef.current) {
      const videoElement = videoRef.current;
      if (!videoElement) return;

      const player = playerRef.current = (window as any).videojs(videoElement, options, async () => {
        console.log("player is ready");
        onReady && onReady(player);

        const savedTime = await get<{ id: string, currentTime: number }>(STORES.PROGRESS, src);
        if (savedTime) {
          player.currentTime(savedTime.currentTime);
        }

        player.on("timeupdate", () => {
          set(STORES.PROGRESS, { id: src, currentTime: player.currentTime() });
        });
      });
    }
  }, [options, videoRef, src]);

  useEffect(() => {
    const player = playerRef.current;
    return () => {
      if (player) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [playerRef]);

  return (
    <div data-vjs-player>
      <video ref={videoRef} className="video-js vjs-big-play-centered" />
    </div>
  );
}