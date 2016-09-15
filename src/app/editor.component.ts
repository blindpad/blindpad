import { Component, ElementRef, OnInit, ViewEncapsulation, OnDestroy, OnChanges, Input } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { Observer } from 'rxjs/Observer';
import * as _ from 'lodash';

import { buildEditor, getModeForMime, EditorMode } from '../util/CodeMirror';
import { AutoEditor } from '../util/AutoEditor';
import { EXAMPLES } from '../util/ExampleCode';
import { PadModel } from '../services/PadModel';
import { PadEdit, Cursor } from '../signaler/Protocol';

// lots of handy stuff: https://github.com/Operational-Transformation/ot.js/blob/master/lib/codemirror-adapter.js

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

    private remoteEditSub: Subscription;
    private localEdits: Observer<PadEdit[]>;
    private mimeSub: Subscription;

    private remoteCursors: { [key: string]: CodeMirror.TextMarker } = {};

    constructor(
        private elementRef: ElementRef) { }

    ngOnInit() {
        this.editor = buildEditor(this.elementRef.nativeElement);

        this.autoEditor = new AutoEditor();
        this.autoEditsSub = this.autoEditor.getEdits().subscribe(edit => this.onRemoteEdits([edit]));
        this.autoModeSub = this.autoEditor.getMode().subscribe(this.setMode);

        this.editor.on('changes', this.onEditorChanges);
        this.editor.on('cursorActivity', this.onCursorActivity);
        this.editor.on('focus', this.onEditorFocus);
        this.editor.on('blur', this.onEditorBlur);

        this.ngOnChanges();
    }

    ngOnDestroy() {
        this.autoEditor.stop();
        this.autoEditsSub.unsubscribe();
        this.autoModeSub.unsubscribe();

        this.editor.off('changes', this.onEditorChanges);
        this.editor.off('cursorActivity', this.onCursorActivity);
        this.editor.off('focus', this.onEditorFocus);
        this.editor.off('blur', this.onEditorBlur);

        this.ngOnChanges();
    }

    ngOnChanges() {
        if (this.remoteEditSub) {
            this.remoteEditSub.unsubscribe();
            this.remoteEditSub = null;
            this.localEdits = null;
        }
        if (this.mimeSub) {
            this.mimeSub.unsubscribe();
            this.mimeSub = null;
        }
        const pad = this.pad;
        if (!this.editor) return;
        if (!pad || !pad.isStarted()) this.setDemoMode(true);
        if (!pad) return;

        this.remoteEditSub = pad.getRemoteEdits().subscribe(this.onRemoteEdits);
        this.localEdits = pad.getLocalEdits();
        this.mimeSub = pad.getMimeType().subscribe(mime => this.setMode(getModeForMime(mime)));
    }

    onEditorClick(event: MouseEvent) {
        this.editor.focus();
    }

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

    private onEditorChanges = (instance: CodeMirror.Editor, changes: CodeMirror.EditorChangeLinkedList[]) => {
        if (this.applyingRemoteChanges || this.isDemoMode) {
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

    private onLocalCursorChanged() {
        // we need this to get called when the local cursor changes
    }

    private getCursorPositions() {
        // give back what we believe to be the current positions of all cursors in the doc
        // find on the selection objects
    }

    private setCursorPositions(newCursors: { [key: string]: Cursor }) {
        if (!this.pad) return;
        if (!newCursors) newCursors = {};

        const doc = this.editor.getDoc();

        _.each(newCursors, (cursor, id) => {
            if (!cursor) return;
            let marker = this.remoteCursors[id];

            if (marker) { // existing markers can stay if they line up with what we've been told should be true
                const existingPos = marker.find();
                const start = doc.indexFromPos(existingPos.from);
                const end = doc.indexFromPos(existingPos.to);
                if (cursor.startIndex === start && cursor.endIndex === end) return;
            }
            //make bookmarks for zero-ranged cursors, marktext for others
            doc.posFromIndex

            const cursorEl = document.createElement('span') as HTMLSpanElement;
            // cursorEl.className = 'other-client';
            cursorEl.style.display = 'inline-block';
            cursorEl.style.padding = '0';
            cursorEl.style.marginLeft = cursorEl.style.marginRight = '-1px';
            cursorEl.style.borderLeftWidth = '2px';
            cursorEl.style.borderLeftStyle = 'solid';
            cursorEl.style.borderLeftColor = 'red';
            cursorEl.style.height = (cursorCoords.bottom - cursorCoords.top) * 0.9 + 'px';
            cursorEl.style.zIndex = '0';
        });

        this.editor.getDoc().setBookmark
        // // remove old cursors
        // _.each(this.cursorElems, (elem, id) => {
        //     // clear on selection objects
        //     if (!newElems[id]) {
        //         elem.remove();
        //     }
        // });

        // if (!cursor && existing) { // clear the existing (if it exists) if we have a null entry in the new map
        //     existing.clear();
        //     delete this.remoteCursors[id];
        // }

        // set cursors
    }

    private onCursorActivity = (instance: CodeMirror.Editor) => {
        // console.log('cursor activity: ', instance);
    };

    private onEditorFocus = (instance: CodeMirror.Editor) => {
        // console.log('focus: ', instance);
    };

    private onEditorBlur = (instance: CodeMirror.Editor) => {
        // console.log('blur: ', instance);
    };

}
