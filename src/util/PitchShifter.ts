const pool = require('typedarray-pool');

interface PitchShiftOptions {
    frameSize?: number;
    hopSize?: number;
    sampleRate?: number;
    maxDataSize?: number;
    analysisWindow?: Float32Array;
    synthesisWindow?: Float32Array;
    freqThreshold?: number;
    minPeriod?: number;
    harmonicScale?: number;
}

const pitchShift = require('pitch-shift') as (onData: (data: Float32Array) => void, onTune: (time: number, pitch: number) => number, options: PitchShiftOptions) => (data: Float32Array) => void;

const FRAME_SIZE = 1024;
const HOP_SIZE = 256;

export class PitchShifter {

    private node: AudioNode;
    private targetPitch: number;
    private pitchScale: number;

    constructor(private context: AudioContext) {
        this.targetPitch = null;
        this.pitchScale = null;

        const queue: Array<Float32Array> = [];
        const shifter = pitchShift(
            data => {
                const buf = pool.mallocFloat32(data.length);
                buf.set(data);
                queue.push(buf);
            },
            (time, pitch) => {
                if (this.targetPitch !== null) {
                    return this.targetPitch / pitch;
                } else if (this.pitchScale !== null) {
                    return this.pitchScale;
                } else {
                    return 1.0;
                }
            },
            {
                frameSize: FRAME_SIZE,
                hopSize: HOP_SIZE
            }
        );
        // Enque some garbage to buffer stuff
        shifter(new Float32Array(FRAME_SIZE));
        shifter(new Float32Array(FRAME_SIZE));
        shifter(new Float32Array(FRAME_SIZE));
        shifter(new Float32Array(FRAME_SIZE));
        shifter(new Float32Array(FRAME_SIZE));

        // this.node = this.context.createGain();
        // (this.node as GainNode).gain.value = 1.0;

        const node = this.context.createScriptProcessor(FRAME_SIZE, 1, 1);
        node.onaudioprocess = e => {
            shifter(e.inputBuffer.getChannelData(0));
            const out = e.outputBuffer.getChannelData(0);
            const q = queue.shift();
            out.set(q);
            pool.freeFloat32(q);
        };
        this.node = node;
    }

    /**
     * Set a constant factor by which the input pitch should be scaled.
     */
    setPitchScale(pitchScale: number) {
        this.pitchScale = pitchScale;
        this.targetPitch = null;
    }

    /**
     * Set a goal / target pitch that we will attempt to shift each frame to.
     */
    setTargetPitch(targetPitch: number) {
        this.pitchScale = null;
        this.targetPitch = targetPitch;
    }

    /**
     * Returns the processor node for the pitch shift to insert into a WebAudio topology
     */
    getNode(): AudioNode {
        return this.node;
    }

}
