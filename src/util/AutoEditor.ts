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

    private curDocIdx: number = null;
    private curPosition: number = null;

    start(docs: {text: string, mode: EditorMode}[], baseTime = 100, wiggleTime = 100): void {
        if (this.isRunning()) return;
        this.docs = docs;
        this.baseTime = baseTime;
        this.wiggleTime = wiggleTime;
        this.requestId = window.setTimeout(this.onTick, this.getNextTimeout());

        this.curDocIdx = Math.floor(Math.random() * this.docs.length);
        this.curPosition = 0;
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

        const doc = this.docs[this.curDocIdx];
        if (this.curPosition === 0) this.mode.next(doc.mode);

        let chunk = doc.text.substring(this.curPosition, this.curPosition + 1);
        for (let i = this.curPosition + chunk.length, next = doc.text.substring(i, i + 1);
                next !== '' && ' \t\n\r\v'.indexOf(next) > -1;
                i++, next = doc.text.substring(i, i + 1)) {
            chunk += next;
        }

        if (chunk.length > 0) { // emit as insert
            const edit = new PadEdit();
            edit.isInsert = true;
            edit.index = this.curPosition;
            edit.text = chunk;
            this.curPosition += chunk.length;
            this.edits.next(edit);
        } else { // we've reached the end, delete and advance to next doc
            const edit = new PadEdit();
            edit.isInsert = false;
            edit.index = 0;
            edit.text = doc.text;
            this.curDocIdx = (this.curDocIdx + 1) % this.docs.length;
            this.curPosition = 0;
            this.edits.next(edit);
        }

        const timeout = this.getNextTimeout();
        if (this.isRunning()) this.requestId = window.setTimeout(this.onTick, timeout);
    };

    private getNextTimeout(): number {
        return this.baseTime + (Math.random() - 0.5) * this.wiggleTime;
    }
}
