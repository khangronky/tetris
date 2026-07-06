import type { FounderRank } from "./types";

export const BASE_WALL_POINTS = 100;
export const PERFECT_POINTS = 50;
export const COMBO_POINTS = 25;
export const NO_MISS_BONUS = 500;

export function scoreWall({
  perfect,
  combo,
}: {
  perfect: boolean;
  combo: number;
}) {
  return (
    BASE_WALL_POINTS +
    (perfect ? PERFECT_POINTS : 0) +
    (combo > 1 ? COMBO_POINTS : 0)
  );
}

export function getNoMissBonus({
  wallsAttempted,
  wallsPassed,
}: {
  wallsAttempted: number;
  wallsPassed: number;
}) {
  if (wallsAttempted === 0) {
    return 0;
  }

  return wallsAttempted === wallsPassed ? NO_MISS_BONUS : 0;
}

export function getAccuracy({
  wallsAttempted,
  wallsPassed,
}: {
  wallsAttempted: number;
  wallsPassed: number;
}) {
  if (wallsAttempted === 0) {
    return 0;
  }

  return Math.round((wallsPassed / wallsAttempted) * 100);
}

export function getFounderRank(score: number): FounderRank {
  if (score >= 5000) {
    return "Future Billionaire";
  }

  if (score >= 3500) {
    return "Unicorn Builder";
  }

  if (score >= 2200) {
    return "CEO";
  }

  if (score >= 1200) {
    return "Startup Founder";
  }

  if (score >= 500) {
    return "Hustler";
  }

  return "Intern";
}
