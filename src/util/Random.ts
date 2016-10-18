/**
 * Return a shuffled version of the given array
 */
export function shuffle<T>(arr: Array<T>): Array<T> {
    const result = Array.from(arr);
    for (let i = 0, l = result.length; i < l; i++) {
        const rand = randomInt(i, l);
        const t = result[rand];
        result[rand] = result[i];
        result[i] = t;
    }
    return result;
}

/**
 * Get a random integer in the range [lo, hi)
 */
export function randomInt(lo: number, hi: number) {
    return Math.floor(lo + Math.random() * (hi - lo));
}

/**
 * A basic PRNG that can be seeded (unlike the builtin js one)
 * 
 * A simplified typescripty version of
 * https://github.com/DomenicoDeFelice/jsrand
 */
export class SeededRandom {

    private mz: number;
    private mw: number;

    constructor(seed = Math.random()) {
        // Uses only one seed (mw), mz is fixed.
        // Must not be zero, nor 0x9068ffff.
        if (seed === 0 || seed === 0x9068ffff) {
            seed++;
        }
        this.mz = 123456789;
        this.mw = seed;
    }

    /**
     * Returns a pseudo-random number between 0 inclusive and 1 exclusive.
     * Algorithm used is MWC (multiply-with-carry) by George Marsaglia.
     * Implementation based on:
     * http://en.wikipedia.org/wiki/Random_number_generation#Computational_methods
     * http://stackoverflow.com/questions/521295/javascript-random-seeds#19301306
     */
    random = () => {
        let mz = this.mz;
        let mw = this.mw;

        // The 16 least significant bits are multiplied by a constant
        // and then added to the 16 most significant bits. 32 bits result.
        mz = ((mz & 0xffff) * 36969 + (mz >> 16)) & 0xffffffff; // tslint:disable-line
        mw = ((mw & 0xffff) * 18000 + (mw >> 16)) & 0xffffffff; // tslint:disable-line

        this.mz = mz;
        this.mw = mw;

        const x = (((mz << 16) + mw) & 0xffffffff) / 0x100000000; // tslint:disable-line
        return 0.5 + x;
    }
}
