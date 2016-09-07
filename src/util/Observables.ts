import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';

/**
 * Returns an observable that triggers on every animation frame (via requestAnimationFrame).
 * The value that comes through the observable is the time(ms) since the previous frame
 * (or the time since the subscribe call for the first frame)
 */
export function animationFrames(): Observable<number> {
    return getAsyncObservable(window.requestAnimationFrame || window.msRequestAnimationFrame, window.cancelAnimationFrame || window.msCancelRequestAnimationFrame);
}

/**
 * Returns an observable that triggers at roughly the given frequency (in ms) (via setTimeout).
 * The value that comes through the observable is the time(ms) since the previous invocation
 * (or the time since the subscribe call for the first invocation)
 */
export function interval(timeout: number): Observable<number> {
    return getAsyncObservable(handler => window.setTimeout(handler, timeout), window.clearTimeout);
}

/**
 * Adapted from: http://stackoverflow.com/questions/27882764/rxjs-whats-the-difference-among-observer-isstopped-observer-observer-isstopp
 */
function getAsyncObservable(scheduleFn: (handler: any) => number, cancelFn: (handle: number) => void) {

    return Observable.create((observer: Observer<number>) => {
        let startTime = Date.now();
        let requestId: number;
        const callback = (currentTime: number) => {
            // If we have not been disposed, then request the next frame
            if (requestId !== undefined) {
                requestId = scheduleFn(callback);
            }
            observer.next(Math.max(0, currentTime - startTime));
            startTime = currentTime;
        };

        requestId = scheduleFn(callback);

        return () => {
            if (requestId !== undefined) {
                const r = requestId;
                requestId = undefined;
                cancelFn(r);
            }
        };
    });
}
