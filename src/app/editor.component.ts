import { Component, ElementRef, OnInit, ViewEncapsulation, OnDestroy, OnChanges, Input } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { Observer } from 'rxjs/Observer';
import * as _ from 'lodash';

import {
    buildEditor,
    buildRemoteCursorElem,
    getModeForMime,
    EditorMode
} from '../util/CodeMirror';
import { AutoEditor } from '../util/AutoEditor';
import { EXAMPLES } from '../util/ExampleCode';
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
        this.editor.on('cursorActivity', this.onCursorActivity);
        this.editor.on('focus', this.onEditorFocus);
        this.editor.on('blur', this.onEditorBlur);

        this.ngOnChanges();
    }

    ngOnDestroy() {
        this.autoEditor.stop();
        this.autoEditsSub.unsubscribe();
        this.autoModeSub.unsubscribe();

        this.editor.off('changes', this.onLocalEdits);
        this.editor.off('cursorActivity', this.onCursorActivity);
        this.editor.off('focus', this.onEditorFocus);
        this.editor.off('blur', this.onEditorBlur);

        this.ngOnChanges();
    }

    ngOnChanges() {
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

        this.mimeSub = pad.getMimeType().subscribe(mime => this.setMode(getModeForMime(mime)));
        this.remoteEditSub = pad.getRemoteEdits().subscribe(this.onRemoteEdits);
        this.localEdits = pad.getLocalEdits();
        this.remoteCursorSub = pad.getRemoteCursors().subscribe(this.onRemoteCursors);
        this.localCursors = pad.getLocalCursors();
    }

    onEditorClick(event: MouseEvent) {
        this.editor.focus();
    }

    // private getRemoteCursors(): { [key: string]: Cursor } {
    //     const cursors: { [key: string]: Cursor} = {};
    //     if (!this.editor) return cursors;

    //     const doc = this.editor.getDoc();

    //     this.remoteMarkers.forEach((marker: CodeMirror.TextMarker, id: string) => {
    //         const cursor = new Cursor();
    //         const range = marker.find();
    //         cursor.srcId = id;
    //         cursor.startIndex = doc.indexFromPos(range.from);
    //         cursor.endIndex = doc.indexFromPos(range.to);
    //         cursors[id] = cursor;
    //     });

    //     return cursors;
    // }

    private setDemoMode(demoMode: boolean) {
        if (demoMode === this.isDemoMode) return;
        if (demoMode) {
            this.isDemoMode = true;
            this.autoEditor.start(EXAMPLES);
        } else {
            this.autoEditor.stop();
            this.editor.setValue('');
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
        const oldMarkers = this.remoteMarkers || new Map<string, CodeMirror.TextMarker>();
        const newMarkers = new Map<string, CodeMirror.TextMarker>();
        this.remoteMarkers = newMarkers;

        this.editor.operation(() => {
            _.each(cursors, (cursor, id) => {
                if (!cursor || cursor.startIndex === null || cursor.endIndex === null) return;
                const start = Math.min(cursor.startIndex, cursor.endIndex);
                const end = Math.max(cursor.startIndex, cursor.endIndex);

                // existing markers can be reused if they haven't changed
                if (oldMarkers.has(id)) {
                    const oldMarker = oldMarkers.get(id);
                    const oldMarkerPos = oldMarker.find();
                    if (start === doc.indexFromPos(oldMarkerPos.from) && end === doc.indexFromPos(oldMarkerPos.to)) {
                        newMarkers.set(id, oldMarker);
                        oldMarkers.delete(id);
                        return;
                    }
                }

                // make bookmarks for zero-ranged cursors
                if (start === end) {
                    const cursorPos = doc.posFromIndex(start);
                    const cursorEl = buildRemoteCursorElem(cursorPos, doc, editor);
                    const newMarker = doc.setBookmark(cursorPos, { widget: cursorEl, insertLeft: true });
                    newMarkers.set(id, newMarker);
                    return;
                }

                // do a marktext for ranged cursors
                // TODO: monkey with options to set color
                // TODO: could generate styles programmatically in the palette library for the color names
                const newMarker = doc.markText(doc.posFromIndex(start), doc.posFromIndex(end), {});
                newMarkers.set(id, newMarker);
            });

            // clear the old markers
            oldMarkers.forEach(marker => marker.clear());
        });
    }

    private onLocalCursor = () => {

    };

    private onLocalCursorChanged() {
        // we need this to get called when the local cursor changes
    }

    private onCursorActivity = (instance: CodeMirror.Editor) => {
        // console.log('cursor activity: ', instance);
    };

    private onEditorFocus = (instance: CodeMirror.Editor) => {
        //trigger cursor update
        // console.log('focus: ', instance);
    };

    private onEditorBlur = (instance: CodeMirror.Editor) => {
        // console.log('blur: ', instance);
    };

}
