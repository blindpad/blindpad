import { Subscription } from 'rxjs/Subscription';
const detectPitch = require('detect-pitch') as (signal: Float32Array | {shape: ArrayLike<number>}, threshold: number) => number;

import { animationFrames } from '../util/Observables';

/**
 * The volume underneath which we'll consider the user not to be talking
 */
const VOL_CUTOFF = 150;

const DESIRED_MEASUREMENTS = 60;

const SIGNAL_BUFFER_SIZE = 4096;

/**
 * Autocorrelation is supposed to take a while to become accurate so let's throw away our first few measurements
 */
const INITIAL_DISCARD_NUM = 20;

/**
 * Between 0 and 1 which determines the cutoff for reporting a successful detection.
 * Higher values indicate stricter cutoff.
 */
const AUTOCORRELATION_THRESHOLD = 0.4;

const HUMAN_PITCH_MIN = 70.0;
const HUMAN_PITCH_MAX = 360.0;

/**
 * Notes adapted from reading random papers:
 * 
 * - Human pitch lies in the interval 80-350 Hz.
 * - The pitch for men is normally around 150 Hz, for women around 250 Hz and children even higher.
 * 
 * A typical adult male will have a fundamental frequency of from 85 to 155 Hz, and that of a typical
 * adult female from 165 to 255 Hz. Children and babies have even higher fundamental frequencies.
 * Infants show a range of 250 to 650 Hz, and in some cases go over 1000 Hz.  A 10-year-old boy
 * or girl might have a fundamental frequency around 400 Hz. When we speak, it is natural for our
 * fundamental frequency to vary within a range of frequencies. This is heard as the intonation
 * pattern or melody of natural speech.  When we sing a song, we are controlling the fundamental
 * frequency of our voice according to the melody of that song.  Since a person's voice typically
 * varies over a range of fundamental frequencies, it is more accurate to speak of a person having
 * a range of fundamental frequencies, rather than one specific fundamental frequency.
 * Nevertheless, a person's relaxed voice usually can be characterized by a "natural" fundamental
 * frequency that is comfortable for that person.
 */
export class PitchDetector {

    private source: AudioNode;
    private analyser: AnalyserNode;
    private signalBuffer: Float32Array;
    private freqBuffer: Uint8Array;
    private runningSub: Subscription;

    private numMeasurements: number;
    private numGoodMeasurements: number;
    private weightedMeasurementsSum: number;
    private weightsSum: number;
    private pitches: Array<number>;
    private measurements: Array<{ pitch: number, vol: number, hVol: number }>;
    private estimate: number;

    constructor(
        private context: AudioContext
    ) { }

    start(source: AudioNode): void {
        if (this.isRunning()) return;
        this.source = source;
        this.analyser = this.context.createAnalyser();
        this.signalBuffer = new Float32Array(SIGNAL_BUFFER_SIZE);
        this.freqBuffer = new Uint8Array(this.analyser.frequencyBinCount);

        this.source.connect(this.analyser);

        this.estimate = undefined;
        this.numMeasurements = 0;
        this.numGoodMeasurements = 0;
        this.weightedMeasurementsSum = 0;
        this.weightsSum = 0;
        this.measurements = [];
        this.pitches = [];

        this.runningSub = animationFrames().subscribe(animTime => {
            this.numMeasurements++;
            this.analyser.getFloatTimeDomainData(this.signalBuffer);
            this.analyser.getByteFrequencyData(this.freqBuffer);
            const period = detectPitch(this.signalBuffer, AUTOCORRELATION_THRESHOLD);

            const fftSize = this.analyser.fftSize;
            const sampleRate = this.context.sampleRate;
            const freqBuf = this.freqBuffer;
            const nFreqBuckets = freqBuf.length;
            const bucketWidth = sampleRate / fftSize;
            let sum = 0.0;
            let humanRangeSum = 0.0;
            let nHumanBuckets = 0;
            for (let i = 0; i < nFreqBuckets; i++) {
                const freq = i * bucketWidth;
                const val = freqBuf[i] / 255.0 * bucketWidth;
                if (freq >= HUMAN_PITCH_MIN && freq <= HUMAN_PITCH_MAX) {
                    nHumanBuckets++;
                    humanRangeSum += val;
                }
                sum += val;
            }

            const pitch = period ? sampleRate / period : null;
            const vol = sum;
            const humanVol = humanRangeSum;

            if (pitch === null) return; // none detected
            if (this.numMeasurements < INITIAL_DISCARD_NUM) return;
            if (vol < VOL_CUTOFF) return; // too quiet
            if (pitch < HUMAN_PITCH_MIN || pitch > HUMAN_PITCH_MAX) return;

            this.numGoodMeasurements++;

            const weight = humanVol;
            this.weightedMeasurementsSum += weight * pitch;
            this.weightsSum += weight;
            this.pitches.push(pitch);
            this.estimate = undefined;
            this.measurements.push({ pitch: pitch, vol: vol, hVol: humanVol });

            // TODO: take first k then disregard multiples after that?
        });
    }

    stop(): void {
        if (!this.isRunning()) return;
        // console.log('\npitch:\n' + this.measurements.map(p => p.pitch).join('\n'));
        // console.log('\nvol:\n' + this.measurements.map(p => p.vol).join('\n'));
        // console.log('\nhVol:\n' + this.measurements.map(p => p.hVol).join('\n'));
        this.runningSub.unsubscribe();
        this.runningSub = null;

        this.source.disconnect(this.analyser);

        this.source = null;
        this.analyser = null;
        this.signalBuffer = null;
        this.freqBuffer = null;
    }

    isRunning(): boolean {
        return !!this.runningSub;
    }

    getEstimate(): number {
        // return this.weightedMeasurementsSum / this.weightsSum;
        if (this.estimate !== undefined) return this.estimate;
        this.estimate = median(this.pitches);
        return this.estimate;
    }

    hasGoodEstimate(): boolean {
        return this.getEstimateQuality() >= 1.0;
    }

    getEstimateQuality(): number {
        return Math.min(this.numGoodMeasurements / DESIRED_MEASUREMENTS, 1.0);
    }

}

/**
 * Gets the median (has the side effect of sorting the array)
 */
function median(values: Array<number>): number {
    if (values.length === 0) return NaN;
    values.sort((a, b) => a - b);
    const half = Math.floor(values.length / 2);
    return values.length % 2 ? values[half] : ((values[half - 1] + values[half]) / 2.0);
}
