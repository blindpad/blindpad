import { PitchDetector } from './PitchDetector';
import { PitchShifter } from './PitchShifter';

const DEFAULT_TOLERANCE = 10.0;
const OUTPUT_TEST_AUDIO = false;

describe('Pitch', () => {

    let ctx: AudioContext;
    let shifter: PitchShifter;
    let detector: PitchDetector;

    beforeEach(() => {
        ctx = new AudioContext();
        shifter = new PitchShifter(ctx);
        detector = new PitchDetector(ctx);
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
    });

    afterEach(() => {
        ctx.close();
    });

    function expectPitch(filename: string, freq: number, done: DoneFn, tolerance = DEFAULT_TOLERANCE, procNode?: AudioNode) {
        const audio = new Audio(filename);
        const stream = ctx.createMediaElementSource(audio);

        audio.onended = () => {
            detector.stop();
            const estimate = detector.getEstimate();
            expect(estimate).toBeDefined();
            expect(estimate).not.toBeNull();

            console.log('estimate on ', filename, ' is ', estimate); // tslint:disable-line

            if (freq > 0) {
                expect(estimate).not.toBeNaN();
                expect(Math.abs(estimate - freq)).toBeLessThan(tolerance);
            } else if (!freq) {
                expect(estimate).toBeNaN();
            }

            done();
        };

        if (procNode) {
            stream.connect(procNode);
            detector.start(procNode);
            if (OUTPUT_TEST_AUDIO) procNode.connect(ctx.destination);
        } else {
            detector.start(stream);
            if (OUTPUT_TEST_AUDIO) stream.connect(ctx.destination);
        }

        audio.play();
    }

    function expectShiftedPitch(filename: string, freq: number, done: DoneFn, tolerance = DEFAULT_TOLERANCE) {
        expectPitch(filename, freq, done, tolerance, shifter.getNode());
    }

    describe('PitchShifter', () => {
        it('doesnt mess with the input by default', done => {
            expectShiftedPitch(require('../assets/test/tone_100hz.mp3'), 100, done);
        });

        it('scales a reference tone', done => {
            const reference = 100.0;
            const scale = 2.0;
            shifter.setPitchScale(scale);
            expectShiftedPitch(require('../assets/test/tone_100hz.mp3'), reference * scale, done);
        });

        it('retargets a referece tone', done => {
            const target = 300.0;
            shifter.setTargetPitch(target);
            expectShiftedPitch(require('../assets/test/tone_100hz.mp3'), target, done, DEFAULT_TOLERANCE * 2);
        });

        it('scales a spoken tone (male)', done => {
            const reference = 115.0;
            const scale = 2.5;
            shifter.setPitchScale(scale);
            expectShiftedPitch(require('../assets/test/male_tone_115hz.mp3'), reference * scale, done);
        });

        it('scales up 8 spoken reference phrases', done => {
            const reference = 115.0;
            const scale = 1.5;
            shifter.setPitchScale(scale);
            expectShiftedPitch(require('../assets/test/male_8_phrases_115hz.mp3'), reference * scale, done);
        });

        it('scales down 2 spoken reference phrases', done => {
            const reference = 200.0;
            const scale = 0.75;
            shifter.setPitchScale(scale);
            expectShiftedPitch(require('../assets/test/female_2_phrases_200hz.mp3'), reference * scale, done);
        });

        it('scales down 8 spoken reference phrases', done => {
            const reference = 200.0;
            const scale = 0.75;
            shifter.setPitchScale(scale);
            expectShiftedPitch(require('../assets/test/female_8_phrases_200hz.mp3'), reference * scale, done);
        });

    });

    describe('PitchDetector', () => {
        it('detects a reference tone of 100hz', done => {
            expectPitch(require('../assets/test/tone_100hz.mp3'), 100, done);
        });

        it('detects a reference tone of 250hz', done => {
            expectPitch(require('../assets/test/tone_250hz.mp3'), 250, done);
        });

        it('detects a quiet room as NaN', done => {
            expectPitch(require('../assets/test/quiet_room.mp3'), null, done);
        });

        it('detects spoken reference tone (male) near 115hz', done => {
            expectPitch(require('../assets/test/male_tone_115hz.mp3'), 115, done);
        });

        it('detects 2 spoken reference phrases (male) near 115hz', done => {
            expectPitch(require('../assets/test/male_2_phrases_115hz.mp3'), 115, done);
        });

        it('detects 8 spoken reference phrases (male) near 115hz', done => {
            expectPitch(require('../assets/test/male_8_phrases_115hz.mp3'), 115, done);
        });

        it('detects 2 spoken reference phrases (female) near 200hz', done => {
            expectPitch(require('../assets/test/female_2_phrases_200hz.mp3'), 200, done);
        });

        it('detects 8 spoken reference phrases (female) near 200hz', done => {
            expectPitch(require('../assets/test/female_8_phrases_200hz.mp3'), 200, done);
        });

    });

});
