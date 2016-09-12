import { Component, ElementRef, OnInit, ViewEncapsulation, OnDestroy, OnChanges, Input } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { Observer } from 'rxjs/Observer';

import { buildEditor, getModeForMime, DEFAULT_TEXT } from '../util/CodeMirror';
import { PadModel } from '../services/PadModel';
import { PadEdit } from '../signaler/Protocol';

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

    private remoteEditSub: Subscription;
    private localEdits: Observer<PadEdit[]>;
    private mimeSub: Subscription;

    constructor(
        private elementRef: ElementRef) { }

    ngOnInit() {
        this.editor = buildEditor(this.elementRef.nativeElement);
        this.editor.on('changes', this.onEditorChanges);
        this.editor.on('cursorActivity', this.onCursorActivity);
        this.editor.on('focus', this.onEditorFocus);
        this.editor.on('blur', this.onEditorBlur);

        this.ngOnChanges();
    }

    ngOnDestroy() {
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
        if (!pad || !this.editor) {
            if (this.editor) this.setDemoMode(true);
            return;
        }
        if (!pad.isStarted()) this.setDemoMode(true);

        this.remoteEditSub = pad.getRemoteEdits().subscribe(this.onRemoteEdits);
        this.localEdits = pad.getLocalEdits();
        // this.editor.setValue(pad.getContents());

        this.mimeSub = pad.getMimeType().subscribe(mime => {
            this.editor.setOption('mode', getModeForMime(mime).mime);
        });
    }

    onEditorClick(event: MouseEvent) {
        this.editor.focus();
    }

    private setDemoMode(demoMode: boolean) {
        if (demoMode === this.isDemoMode) return;
        if (demoMode) {
            this.isDemoMode = true;
            this.editor.setValue(DEFAULT_TEXT);
        } else {
            this.editor.setValue('');
            this.isDemoMode = false;
        }
    }

    private onRemoteEdits = (edits: PadEdit[]) => {
        this.setDemoMode(false);
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
                const removeEdit: PadEdit = {isInsert: false, index: idx, text: removed };
                edits.push(removeEdit);
            }
            // nonempt added = added at index
            if (inserted.length > 0) {
                const insertEdit: PadEdit = {isInsert: true, index: idx, text: inserted };
                edits.push(insertEdit);
            }
            if (edits.length > 0 && this.localEdits) {
                this.localEdits.next(edits);
            }
        });
    };

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
