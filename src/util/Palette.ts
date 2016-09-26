import { shuffle } from './Random';

export interface PaletteColor {
    id: string;
    val: string;
    darkText: boolean;
}

export const PRIMARY = {
    RED:            { id: 'RED',         val: '#F44336', darkText: false } as PaletteColor,
    PINK:           { id: 'PINK',        val: '#E91E63', darkText: false } as PaletteColor,
    PURPLE:         { id: 'PURPLE',      val: '#9C27B0', darkText: false } as PaletteColor,
    DEEP_PURPLE:    { id: 'DEEP_PURPLE', val: '#673AB7', darkText: false } as PaletteColor,
    INDIGO:         { id: 'INDIGO',      val: '#3F51B5', darkText: false } as PaletteColor,
    BLUE:           { id: 'BLUE',        val: '#2196F3', darkText: false } as PaletteColor,
    LIGHT_BLUE:     { id: 'LIGHT_BLUE',  val: '#03A9F4', darkText: true  } as PaletteColor,
    CYAN:           { id: 'CYAN',        val: '#00BCD4', darkText: true  } as PaletteColor,
    TEAL:           { id: 'TEAL',        val: '#009688', darkText: false } as PaletteColor,
    GREEN:          { id: 'GREEN',       val: '#4CAF50', darkText: true  } as PaletteColor,
    LIGHT_GREEN:    { id: 'LIGHT_GREEN', val: '#8BC34A', darkText: true  } as PaletteColor,
    LIME:           { id: 'LIME',        val: '#CDDC39', darkText: true  } as PaletteColor,
    YELLOW:         { id: 'YELLOW',      val: '#FFEB3B', darkText: true  } as PaletteColor,
    AMBER:          { id: 'AMBER',       val: '#FFC107', darkText: true  } as PaletteColor,
    ORANGE:         { id: 'ORANGE',      val: '#FF9800', darkText: true  } as PaletteColor,
    DEEP_ORANGE:    { id: 'DEEP_ORANGE', val: '#FF5722', darkText: false } as PaletteColor,
    BROWN:          { id: 'BROWN',       val: '#795548', darkText: false } as PaletteColor,
    GREY:           { id: 'GREY',        val: '#9E9E9E', darkText: true  } as PaletteColor,
    BLUE_GREY:      { id: 'BLUE_GREY',   val: '#607D8B', darkText: false } as PaletteColor
};

export const PRIMARY_COLOR = 'BLUE';

export const COLOR_NAMES: string[] = Object.keys(PRIMARY);

export const SHUFFLED_COLOR_NAMES: string[] = shuffle(COLOR_NAMES);

export const SHUFFLED_PRIMARY_FIRST: string[] = [ PRIMARY_COLOR ].concat(SHUFFLED_COLOR_NAMES.filter(c => c !== PRIMARY_COLOR));

export const NUM_COLORS: number = COLOR_NAMES.length;

export function getColor(idx: number, shuffled = false, primaryFirst = false): PaletteColor {
    const index = idx % NUM_COLORS;
    const arr = shuffled ? (primaryFirst ? SHUFFLED_PRIMARY_FIRST : SHUFFLED_COLOR_NAMES) : COLOR_NAMES;
    return PRIMARY[arr[index]];
}

const generatedRules: Map<string, string> = new Map<string, string>();
export function getBackgroundClass(color: PaletteColor): string {
    const className = `color-${color.id}-background`;
    if (generatedRules.has(className)) return className;
    const rule = `.${className} {
        background: ${color.val};
        color: ${color.darkText ? 'black' : 'white'} !important;
    }`;
    const sheet = getSheet();
    if (sheet) sheet.insertRule(rule, generatedRules.size); // silently fail if no sheet (because we're in a webworker or something)
    generatedRules.set(className, rule);
    return className;
}

let paletteSheet: CSSStyleSheet = null;
function getSheet(): CSSStyleSheet {
    if (paletteSheet !== null) return paletteSheet;
    const doc = self.document;
    if (!doc) return null;
    const styleElem = doc.createElement('style');
    styleElem.type = 'text/css';
    styleElem.className = 'palette';
    doc.getElementsByTagName('head')[0].appendChild(styleElem);
    paletteSheet = styleElem.sheet as CSSStyleSheet;
    return paletteSheet;
}
