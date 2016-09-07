import {
    trigger,
    state,
    style,
    transition,
    animate
} from '@angular/core';

export const fadeInOut = trigger('fadeInOut', [
    state('*',
        style({
            opacity: 1.0,
            height: '*'
        })),
    transition('void => *', [
        style({
            opacity: 0.0,
            height: 0
        }),
        animate('300ms ease-in')
    ]),
    transition('* => void', [
        animate('300ms ease-out', style({
            opacity: 0.0,
            height: 0
        }))
    ])
]);
