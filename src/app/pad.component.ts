import {
    Component,
    OnInit,
    OnDestroy
} from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs/Subscription';
import * as bowser from 'bowser';

import { BlindpadService } from '../services/blindpad.service';
import { MediaService } from '../services/media.service';
import { UserModel } from '../services/UserModel';
import { getDescribedNoun } from '../util/Names';
import { getModeForMime, EditorMode, MODES } from '../util/CodeMirror';
import { fadeInOut } from '../util/Animations';

enum PadView {
    Welcome,
    AudioSetup,
    Editor,
    About
}

@Component({
    selector: 'pad',
    templateUrl: 'pad.component.html',
    styleUrls: ['pad.component.scss'],
    animations: [ fadeInOut ]
})
export class PadComponent implements OnInit, OnDestroy {

    PadView = PadView;
    visibleModeChoices: EditorMode[] = null;

    private routeSub: Subscription;
    private randomPadId: string;
    private view: PadView;

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private blindpadService: BlindpadService,
        public media: MediaService
    ) { }

    ngOnInit() {
        this.routeSub = this.route.params.subscribe(params => {
            const url = this.route.snapshot.url[0];
            const path = url ? url.path : '';
            const urlPadId: string = params['id'];
            this.randomPadId = getDescribedNoun('Pad', 10000);

            // if we're being asked to load a different pad than we're currently showing close the one we're showing
            if (this.blindpadService.getPadId() && this.blindpadService.getPadId() !== urlPadId) {
                this.blindpadService.setPadId(null);
            }

            if (path === 'pad' && urlPadId) {
                this.blindpadService.setPadId(urlPadId);
                if (!this.media.needsCalibration()) { // if we're not calibrating turn the mic on now
                    this.media.initializeLocal();
                }
                // if we've already turned this pad on (presumably before navigating here) don't bother with the welcome screen
                this.view = this.blindpadService.isPadStarted() ? PadView.Editor : PadView.Welcome;
            } else if (path === 'about') {
                this.view = PadView.About;
            } else {
                this.view = PadView.Welcome;
            }
        });
    }

    ngOnDestroy() { this.routeSub.unsubscribe(); }
    isChromeOnMac(): boolean { return !!bowser.chrome && !!bowser['mac']; }
    optOutOfVoice() {
        this.media.setOptOut();
        this.view = PadView.Welcome;
    }

    getView(): PadView { return this.view; }
    startAudioSetup(): void {
        this.media.initializeLocal();
        this.view = PadView.AudioSetup;
    }

    getUsers(): UserModel[] {
        if (!this.hasPad()) return [];
        return Array.from(this.getPad().getUsers().values());
    }

    getPad() { return this.blindpadService.getPad().value; }
    getJoinId() { return this.hasPad() ? this.getPad().getPadId() : this.randomPadId; }
    hasPad() { return !!this.getPad(); }
    joinPad() {
        if (this.hasPad()) {
            this.blindpadService.startPad();
            this.view = PadView.Editor;
        } else {
            this.blindpadService.setPadId(this.randomPadId);
            this.blindpadService.startPad();
            this.router.navigate(['/pad', this.randomPadId]);
        }
    }

    getPadMode(): EditorMode {
        const pad = this.getPad();
        if (!pad) return null;
        return getModeForMime(pad.getMimeType().value);
    }

    onModeButtonClick() {
        if (this.visibleModeChoices) {
            this.visibleModeChoices = null;
        } else {
            this.visibleModeChoices = MODES;
        }
    }

    onModeChoice(choice: EditorMode) {
        if (!choice || !this.hasPad()) {
            this.visibleModeChoices = null;
        } else if (choice.children && choice.children.length > 0) {
            this.visibleModeChoices = choice.children;
        } else {
            this.getPad().setMimeType(choice.mime);
            this.visibleModeChoices = null;
        }
    }

}
