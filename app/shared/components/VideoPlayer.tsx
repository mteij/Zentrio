import { useEffect, useRef } from "preact/hooks";
import { get, set } from "../utils/idb.ts";
import { STORES } from "../utils/idb.ts";

// Define interfaces for Video.js player and options to avoid 'any'
export interface VideoJsPlayer {
  currentTime(time?: number): number;
  on(event: string, callback: () => void): void;
  dispose(): void;
}

export interface VideoJsPlayerOptions {
    autoplay?: boolean;
    controls?: boolean;
    responsive?: boolean;
    fill?: boolean;
    sources?: {
        src: string;
        type: string;
    }[];
    tracks?: {
        kind: string;
        label: string;
        srclang: string;
        src: string;
    }[];
    [key: string]: unknown;
}

// Extend the Window interface to include the videojs global
declare global {
  interface Window {
    videojs: (
      el: HTMLVideoElement,
      options: VideoJsPlayerOptions,
      ready: () => void
    ) => VideoJsPlayer;
  }
}

interface VideoPlayerProps {
  options: VideoJsPlayerOptions;
  onReady?: (player: VideoJsPlayer) => void;
  src: string;
}

export function VideoPlayer({ options, onReady, src }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<VideoJsPlayer | null>(null);

  useEffect(() => {
    if (!playerRef.current) {
      const videoElement = videoRef.current;
      if (!videoElement) return;

      // deno-lint-ignore no-explicit-any
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