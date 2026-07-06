import Image from "next/image";

import { Progress } from "@/components/ui/progress";

import { type LandmarkLike, TARGET_POSES } from "./target-poses";
import type { GameSnapshot } from "./types";

type PoseWallCardProps = {
  snapshot: GameSnapshot;
};

const POSE_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  [11, 12],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [24, 26],
  [25, 27],
  [26, 28],
  [27, 29],
  [28, 30],
  [29, 31],
  [30, 32],
  [27, 31],
  [28, 32],
] as const;

const STATIC_PROGRESS_STATUSES = new Set<GameSnapshot["status"]>([
  "idle",
  "loading",
  "ready",
  "countdown",
]);

export function PoseWallCard({ snapshot }: PoseWallCardProps) {
  const targetPose = TARGET_POSES[snapshot.currentWall.poseId];
  const incomingPercent = STATIC_PROGRESS_STATUSES.has(snapshot.status)
    ? 0
    : Math.round((1 - snapshot.distance) * 100);

  return (
    <section className="rise-card rounded-xl border border-border bg-card/55 p-4 shadow-lg backdrop-blur">
      <div className="rounded-xl border-2 border-primary/75 bg-card/45 px-4 py-3 shadow-[0_16px_40px_color-mix(in_oklch,var(--primary)_16%,transparent)]">
        <div className="text-center">
          <p className="text-base font-black leading-tight text-foreground">
            {snapshot.currentWall.title}
          </p>
          <p className="text-xs font-semibold text-muted-foreground">
            {snapshot.currentWall.theme}
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <div className="overflow-hidden rounded-lg bg-foreground shadow-inner">
            <LandmarkSkeleton landmarks={targetPose.landmarks} />
          </div>
          <div className="overflow-hidden rounded-lg bg-card/45 shadow-inner">
            <div className="relative aspect-2816/1536 overflow-hidden rounded-md bg-card/50">
              <Image
                src={targetPose.image}
                alt={`${snapshot.currentWall.title} template pose`}
                fill
                sizes="160px"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <p className="text-center text-xs font-semibold text-foreground">
          Incoming wall: {incomingPercent}%
        </p>
        <Progress value={incomingPercent} />
      </div>
    </section>
  );
}

function LandmarkSkeleton({
  landmarks,
}: {
  landmarks: readonly LandmarkLike[];
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label="Target pose landmarks"
      className="aspect-2816/1536 w-full overflow-visible rounded-md bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--primary)_20%,transparent),color-mix(in_oklch,var(--foreground)_8%,transparent)_54%,color-mix(in_oklch,var(--foreground)_34%,transparent))]"
    >
      <g strokeLinecap="round" strokeLinejoin="round">
        {POSE_CONNECTIONS.map(([from, to]) => (
          <line
            key={`${from}-${to}`}
            x1={landmarks[from].x * 100}
            y1={landmarks[from].y * 100}
            x2={landmarks[to].x * 100}
            y2={landmarks[to].y * 100}
            stroke="currentColor"
            strokeOpacity="0.78"
            strokeWidth="0.9"
            vectorEffect="non-scaling-stroke"
            className="text-primary"
          />
        ))}
        {landmarks.map((landmark, index) => (
          <circle
            key={`${landmark.x}-${landmark.y}-${landmark.z}`}
            cx={landmark.x * 100}
            cy={landmark.y * 100}
            r={index === 0 ? 1.25 : 0.86}
            fill={index >= 11 ? "var(--color-primary-foreground)" : "var(--color-primary)"}
            stroke="var(--color-foreground)"
            strokeWidth="0.22"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </svg>
  );
}
