import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import { PadEdit } from '../signaler/Protocol';
import { EditorMode, DEFAULT_MODE } from './CodeMirror';

export class AutoEditor {

    private edits = new Subject<PadEdit>();
    private mode = new BehaviorSubject<EditorMode>(DEFAULT_MODE);

    private requestId: number = null;

    private docs: {text: string, mode: EditorMode}[] = null;
    private baseTime: number = null;
    private wiggleTime: number = null;

    start(docs: {text: string, mode: EditorMode}[], baseTime = 200, wiggleTime = 100): void {
        if (this.isRunning()) return;
        this.docs = docs;
        this.baseTime = baseTime;
        this.wiggleTime = wiggleTime;
        this.requestId = window.setTimeout(this.onTick, this.getNextTimeout());
    }

    stop(): void {
        if (!this.isRunning()) return;
        const rid = this.requestId;
        this.requestId = null;
        window.clearTimeout(rid);
    }

    getEdits(): Subject<PadEdit> { return this.edits; }
    getMode(): BehaviorSubject<EditorMode> { return this.mode; }
    isRunning(): boolean { return this.requestId !== null; }

    private onTick = () => {
        if (!this.isRunning()) return;

        this.requestId = window.setTimeout(this.onTick, this.getNextTimeout());
    };

    private getNextTimeout(): number {
        return this.baseTime + (Math.random() - 0.5) * this.wiggleTime;
    }
}
