const LZString = require('lz-string') as LZString.LZStringStatic;

export function compress(s: string): string {
    return LZString.compressToBase64(s);
}

export function decompress(s: string): string {
    return LZString.decompressFromBase64(s);
}

export function compressOpSet(set: Set<string>): string {
    if (set === undefined) return undefined;
    if (set === null) return null;
    return compress(JSON.stringify(set));
}

export function decompressOpSet(str: string): string[] {
    if (str === undefined) return undefined;
    if (str === null) return null;
    return JSON.parse(decompress(str)) as string[];
}
