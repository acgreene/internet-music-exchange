/** Each stand-in track's chord, as frequencies in hertz. */
const CHORDS = [
  [220, 277.18, 329.63],
  [196, 246.94, 293.66],
  [174.61, 220, 261.63],
  [246.94, 311.13, 369.99],
  [164.81, 207.65, 246.94],
];

const FADE_SECONDS = 0.6;

/**
 * Stand-in music for the gallery's previews: a soft chord per track, made
 * in the browser, so a design's play buttons do something without anyone's
 * real music.
 */
export class PlaceholderMusic {
  private context?: AudioContext;
  private playing?: { gain: GainNode; voices: OscillatorNode[] };

  public play(trackPosition: number): void {
    this.stop();
    this.context ??= new AudioContext();
    const context = this.context;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, context.currentTime + FADE_SECONDS);
    gain.connect(context.destination);
    const chord = CHORDS[(trackPosition - 1) % CHORDS.length];
    const voices = chord.map((frequency, i) => {
      const voice = context.createOscillator();
      voice.type = i === 0 ? 'triangle' : 'sine';
      voice.frequency.value = frequency;
      voice.connect(gain);
      voice.start();
      return voice;
    });
    this.playing = { gain, voices };
  }

  public stop(): void {
    if (!this.playing || !this.context) return;
    const { gain, voices } = this.playing;
    const end = this.context.currentTime + FADE_SECONDS;
    gain.gain.cancelScheduledValues(this.context.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(0, end);
    voices.forEach((voice) => voice.stop(end));
    this.playing = undefined;
  }
}
