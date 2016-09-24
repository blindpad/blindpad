import { Component, ElementRef, OnInit, ViewEncapsulation, OnDestroy, OnChanges, Input } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { Observer } from 'rxjs/Observer';

import {
    buildEditor,
    getModeForMime,
    EditorMode
} from '../util/CodeMirror';
import { AutoEditor } from '../util/AutoEditor';
import { EXAMPLES } from '../util/ExampleCode';
import { getBackgroundClass, PRIMARY, PaletteColor } from '../util/Palette';
import { PadModel } from '../services/PadModel';
import { PadEdit, Cursor, CursorMap } from '../signaler/Protocol';

/**
 * The editor component + interface between our PadModel and the Codemirror editor.
 * Much of this is based off the awesome example here:
 * https://github.com/Operational-Transformation/ot.js/blob/master/lib/codemirror-adapter.js
 */
@Component({
    selector: 'editor',
    template: '',
    styleUrls: ['editor.component.scss'],
    encapsulation: ViewEncapsulation.None,
    host: {
        '(click)': 'onEditorClick($event)'
    }
})
export class EditorComponent implements OnInit, OnDestroy, OnChanges {

    @Input() pad: PadModel;

    private editor: CodeMirror.Editor;
    private applyingRemoteChanges = false;

    private isDemoMode = false;
    private autoEditor: AutoEditor;
    private autoEditsSub: Subscription;
    private autoModeSub: Subscription;

    private localUserId: string = null;
    private mimeSub: Subscription;
    private remoteEditSub: Subscription;
    private localEdits: Observer<PadEdit[]>;
    private remoteCursorSub: Subscription;
    private localCursors: Observer<CursorMap>;

    private remoteMarkers: Map<String, CodeMirror.TextMarker> = new Map<String, CodeMirror.TextMarker>();

    constructor(
        private elementRef: ElementRef) {}

    ngOnInit() {
        this.editor = buildEditor(this.elementRef.nativeElement);

        this.autoEditor = new AutoEditor();
        this.autoEditsSub = this.autoEditor.getEdits().subscribe(edit => this.onRemoteEdits([edit]));
        this.autoModeSub = this.autoEditor.getMode().subscribe(this.setMode);

        this.editor.on('changes', this.onLocalEdits);
        this.editor.on('cursorActivity', this.onLocalCursors);

        this.ngOnChanges();
    }

    ngOnDestroy() {
        this.autoEditor.stop();
        this.autoEditsSub.unsubscribe();
        this.autoModeSub.unsubscribe();

        this.editor.off('changes', this.onLocalEdits);
        this.editor.off('cursorActivity', this.onLocalCursors);

        this.ngOnChanges();
    }

    ngOnChanges() {
        this.localUserId = null;
        if (this.mimeSub) {
            this.mimeSub.unsubscribe();
            this.mimeSub = null;
        }
        if (this.remoteEditSub) {
            this.remoteEditSub.unsubscribe();
            this.remoteEditSub = null;
            this.localEdits = null;
        }
        if (this.remoteCursorSub) {
            this.remoteCursorSub.unsubscribe();
            this.remoteCursorSub = null;
            this.localCursors = null;
        }

        const pad = this.pad;
        if (!this.editor) return;
        if (!pad || !pad.isStarted()) this.setDemoMode(true);
        if (!pad) return;
        this.localUserId = pad.getLocalUser().getId();
        this.mimeSub = pad.getMimeType().subscribe(mime => this.setMode(getModeForMime(mime)));
        this.remoteEditSub = pad.getRemoteEdits().subscribe(this.onRemoteEdits);
        this.localEdits = pad.getLocalEdits();
        this.remoteCursorSub = pad.getRemoteCursors().subscribe(this.onRemoteCursors);
        this.localCursors = pad.getLocalCursors();
    }

    onEditorClick(event: MouseEvent) {
        this.editor.focus();
    }

    private getLocalCursor(): Cursor {
        if (!this.editor) return null;
        const doc = this.editor.getDoc();

        const selections = doc.listSelections();
        const cursor = doc.getCursor();
        let pos1: CodeMirror.Position;
        let pos2: CodeMirror.Position;

        if (selections && selections.length > 0) {
            // if we for some reason have more than one selection just send the first one
            pos1 = selections[0].anchor;
            pos2 = selections[0].head;
        } else if (cursor) {
            pos1 = cursor;
            pos2 = cursor;
        }

        if (!pos1 || !pos2) return null;
        const result = new Cursor();
        const idx1 = doc.indexFromPos(pos1);
        const idx2 = doc.indexFromPos(pos2);
        result.srcId = this.localUserId;
        result.startIndex = Math.min(idx1, idx2);
        result.endIndex = Math.max(idx1, idx2);
        return result;
    }

    private getRemoteCursors(): { [key: string]: Cursor } {
        const cursors: { [key: string]: Cursor} = {};
        if (!this.editor) return cursors;

        const doc = this.editor.getDoc();

        this.remoteMarkers.forEach((marker: CodeMirror.TextMarker, id: string) => {
            const cursor = new Cursor();
            const range = indicesFromMarker(marker, doc);
            cursor.srcId = id;
            cursor.startIndex = range.from;
            cursor.endIndex = range.to;
            cursors[id] = cursor;
        });

        return cursors;
    }

    private setDemoMode(demoMode: boolean) {
        if (demoMode === this.isDemoMode) return;
        if (demoMode) {
            this.isDemoMode = true;
            this.autoEditor.start(EXAMPLES);
        } else {
            this.autoEditor.stop();
            this.editor.setValue('');
            this.setMode(getModeForMime(null));
            this.isDemoMode = false;
        }
    }

    private setMode = (mode: EditorMode) => {
        this.editor.setOption('mode', mode.mime);
    }

    private onRemoteEdits = (edits: PadEdit[]) => {
        if (this.isDemoMode && this.pad && this.pad.isStarted()) this.setDemoMode(false);
        this.applyingRemoteChanges = true;
        const doc = this.editor.getDoc();
        this.editor.operation(() => {
            edits.forEach(edit => {
                const start = doc.posFromIndex(edit.index);
                const end = doc.posFromIndex(edit.index + edit.text.length);
                if (edit.isInsert) {
                    doc.replaceRange(edit.text, start, null);
                } else {
                    doc.replaceRange('', start, end);
                }
            });
        });
        this.applyingRemoteChanges = false;
    };

    private onLocalEdits = (instance: CodeMirror.Editor, changes: CodeMirror.EditorChangeLinkedList[]) => {
        if (this.applyingRemoteChanges || this.isDemoMode || !this.localEdits) {
            return;
        }
        const doc = instance.getDoc();
        changes.forEach(change => {
            const idx = doc.indexFromPos(change.from);
            const inserted = change.text.join('\n');
            const removed = change.removed.join('\n');
            const edits: PadEdit[] = [];
            // nonempty removed = remove from from index
            if (removed.length > 0) {
                const removeEdit: PadEdit = { isInsert: false, index: idx, text: removed };
                edits.push(removeEdit);
            }
            // nonempt added = added at index
            if (inserted.length > 0) {
                const insertEdit: PadEdit = { isInsert: true, index: idx, text: inserted };
                edits.push(insertEdit);
            }
            if (edits.length > 0 && this.localEdits) {
                this.localEdits.next(edits);
            }
        });
    };

    private onRemoteCursors = (cursors: { [key: string]: Cursor }) => {
        if (!this.pad) return;

        const editor = this.editor;
        const doc = editor.getDoc();
        const markers = this.remoteMarkers;
        const users = this.pad.getAllUsers();

        this.editor.operation(() => {
            Object.keys(cursors || {}).forEach(id => {
                const cursor = cursors[id];
                const user = users.get(id);
                const color = user ? user.getColor().value : PRIMARY.GREY;
                const start = cursor ? Math.min(cursor.startIndex, cursor.endIndex) : null;
                const end = cursor ? Math.max(cursor.startIndex, cursor.endIndex) : null;

                // existing markers can be reused if they haven't changed
                if (markers.has(id)) {
                    const oldMarker = markers.get(id);
                    const range = indicesFromMarker(oldMarker, doc);
                    // it's gone, out of date, or we've been asked to delete it
                    if (!cursor || start === null || end === null || start !== range.from || end !== range.to) {
                        oldMarker.clear();
                        markers.delete(id);
                    } else {
                        return; // it doesn't need to be changed
                    }
                }

                if (!cursor || start === null || end === null) return;

                // make bookmarks for zero-ranged cursors
                if (start === end) {
                    const cursorPos = doc.posFromIndex(start);
                    const cursorEl = buildRemoteCursorElem(cursorPos, color);
                    const newMarker = doc.setBookmark(cursorPos, { widget: cursorEl, insertLeft: true });
                    markers.set(id, newMarker);
                    return;
                }

                // do a marktext for ranged cursors
                const newMarker = doc.markText(doc.posFromIndex(start), doc.posFromIndex(end), { className: getBackgroundClass(color) });
                markers.set(id, newMarker);
            });
        });
    }

    private onLocalCursors = (instance: CodeMirror.Editor) => {
        if (this.isDemoMode || this.applyingRemoteChanges || !this.localCursors) return;
        const localCursor = this.getLocalCursor();
        const update: CursorMap = {};
        const remote = this.getRemoteCursors();
        Object.keys(remote || {}).forEach(id => update[id] = remote[id]);
        update[this.localUserId] = localCursor;
        this.localCursors.next(update);
    };

}

function indicesFromMarker(marker: CodeMirror.TextMarker, doc: CodeMirror.Doc): {from: number, to: number} {
    if (!marker) return {from: null, to: null};
    const range = marker.find();
    if (!range) return {from: null, to: null};
    let fromPos: CodeMirror.Position;
    let toPos: CodeMirror.Position;
    // typings are wrong, .find on a cursor gives back a pos not a range
    if (range.from === undefined) {
        fromPos = range as any as CodeMirror.Position;
        toPos = range as any as CodeMirror.Position;
    } else {
        fromPos = range.from;
        toPos = range.to;
    }
    let fromIdx = fromPos ? doc.indexFromPos(fromPos) : null;
    let toIdx = toPos ? doc.indexFromPos(toPos) : null;
    return (fromIdx > toIdx) ? {from: toIdx, to: fromIdx} : {from: fromIdx, to: toIdx};
}

function buildRemoteCursorElem(pos: CodeMirror.Position, color: PaletteColor): HTMLSpanElement {
    const el = document.createElement('span');
    el.style.display = 'inline';
    el.style.padding = '0';
    el.style.marginTop = el.style.marginBottom = el.style.marginLeft = el.style.marginRight = '-1px';
    el.style.borderLeftWidth = '2px';
    el.style.borderLeftStyle = 'solid';
    el.style.borderLeftColor = color.val;
    // el.style.zIndex = '0';
    return el;
}
