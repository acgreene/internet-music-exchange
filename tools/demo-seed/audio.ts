import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** How many distinct clips tracks are copied from. */
export const CLIP_COUNT = 24;
export const CLIP_SECONDS = 15;

/** Notes of a major or minor triad above a root, in Hz. */
function chord(root: number, minor: boolean): number[] {
  return [
    root,
    root * Math.pow(2, (minor ? 3 : 4) / 12),
    root * Math.pow(2, 7 / 12),
  ];
}

/**
 * Make the source clips: short lo-fi loops of a chord over a kick and a hat,
 * each in its own key and tempo. Kept in a temporary folder between runs.
 *
 * @returns The clip files, or none when ffmpeg is missing.
 */
export function makeClips(): string[] {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    console.warn('ffmpeg not found: tracks will have no audio.');
    return [];
  }
  const dir = join(tmpdir(), 'ime-demo-audio');
  mkdirSync(dir, { recursive: true });

  const roots = [110, 123.47, 130.81, 146.83, 164.81, 174.61, 196, 220];
  const clips: string[] = [];
  for (let i = 0; i < CLIP_COUNT; i++) {
    const file = join(dir, `clip-${i}.mp3`);
    clips.push(file);
    if (existsSync(file)) continue;

    const [f1, f2, f3] = chord(roots[i % roots.length], i % 3 === 1);
    const beat = (60 / (78 + ((i * 13) % 64))).toFixed(4);
    const wobble = (0.15 + (i % 5) * 0.08).toFixed(2);
    const expression = [
      `0.16*sin(2*PI*${f1}*t)*(0.7+0.3*sin(2*PI*${wobble}*t))`,
      `0.11*sin(2*PI*${f2}*t)`,
      `0.09*sin(2*PI*${f3}*t)`,
      `0.06*sin(2*PI*${f1 * 2}*t)*exp(-mod(t,${beat})*3)`,
      `0.45*exp(-mod(t,${beat})*18)*sin(2*PI*52*t)`,
      `0.05*(random(0)*2-1)*exp(-mod(t+${beat}/2,${beat})*40)`,
    ].join('+');
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `aevalsrc='${expression}':s=44100:d=${CLIP_SECONDS}`,
      '-af',
      `afade=t=in:d=0.5,afade=t=out:st=${CLIP_SECONDS - 1.5}:d=1.5,lowpass=f=5000`,
      '-ac',
      '1',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '40k',
      file,
    ]);
  }
  return clips;
}
