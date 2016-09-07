import * as _ from 'lodash';

export interface PaletteColor {
    val: string;
    darkText: boolean;
}

export const PRIMARY = {
    RED:            { val: '#F44336', darkText: false } as PaletteColor,
    PINK:           { val: '#E91E63', darkText: false } as PaletteColor,
    PURPLE:         { val: '#9C27B0', darkText: false } as PaletteColor,
    DEEP_PURPLE:    { val: '#673AB7', darkText: false } as PaletteColor,
    INDIGO:         { val: '#3F51B5', darkText: false } as PaletteColor,
    BLUE:           { val: '#2196F3', darkText: false } as PaletteColor,
    LIGHT_BLUE:     { val: '#03A9F4', darkText: true  } as PaletteColor,
    CYAN:           { val: '#00BCD4', darkText: true  } as PaletteColor,
    TEAL:           { val: '#009688', darkText: false } as PaletteColor,
    GREEN:          { val: '#4CAF50', darkText: true  } as PaletteColor,
    LIGHT_GREEN:    { val: '#8BC34A', darkText: true  } as PaletteColor,
    LIME:           { val: '#CDDC39', darkText: true  } as PaletteColor,
    YELLOW:         { val: '#FFEB3B', darkText: true  } as PaletteColor,
    AMBER:          { val: '#FFC107', darkText: true  } as PaletteColor,
    ORANGE:         { val: '#FF9800', darkText: true  } as PaletteColor,
    DEEP_ORANGE:    { val: '#FF5722', darkText: false } as PaletteColor,
    BROWN:          { val: '#795548', darkText: false } as PaletteColor,
    GREY:           { val: '#9E9E9E', darkText: true  } as PaletteColor,
    BLUE_GREY:      { val: '#607D8B', darkText: false } as PaletteColor
};

export const PRIMARY_COLOR = 'GREEN';

export const COLOR_NAMES: string[] = _.keys(PRIMARY);

export const SHUFFLED_COLOR_NAMES: string[] = _.shuffle(COLOR_NAMES);

export const SHUFFLED_PRIMARY_FIRST: string[] = _.concat([PRIMARY_COLOR], _.without(SHUFFLED_COLOR_NAMES, PRIMARY_COLOR));

export const NUM_COLORS: number = COLOR_NAMES.length;

export function getColor(idx: number, shuffled = false, primaryFirst = false): PaletteColor {
    const index = idx % NUM_COLORS;
    const arr = shuffled ? (primaryFirst ? SHUFFLED_PRIMARY_FIRST : SHUFFLED_COLOR_NAMES) : COLOR_NAMES;
    return PRIMARY[arr[index]];
}
