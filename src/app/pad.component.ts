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
    animations: [ fadeInOut ],
    host: {
        '(document:click)': 'onDocumentClick($event)'
    }
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

    hasWebRTC(): boolean {
        return hasMethod(window.RTCPeerConnection || window['webkitRTCPeerConnection'], 'createDataChannel')
            && hasMethod(window.navigator, 'getUserMedia');

    }

    hasWebAudio(): boolean {
        return hasMethod(window.AudioContext || window['webkitAudioContext'], 'createMediaStreamDestination');
    }

    browserIsSupported() { return this.hasWebAudio() && this.hasWebRTC(); }

    getView(): PadView { return this.view; }
    getPad() { return this.blindpadService.getPad().value; }
    hasPad() { return !!this.getPad(); }

    /* navigation */

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

    onDocumentClick(event: MouseEvent) {
        if (this.visibleModeChoices === null) return;
        const target = event.target as Element;
        const isModeChoice = target.tagName.toLowerCase() === 'mode-choice';
        const isModeButton = target.classList.contains('mode-button');
        if (isModeButton || isModeChoice) return;
        this.visibleModeChoices = null;
    }

    /* audio setup */

    isChromeOnMac(): boolean { return !!bowser.chrome && !!bowser['mac']; }

    optOutOfVoice() {
        this.media.setOptOut();
        this.view = PadView.Welcome;
    }

    startAudioSetup(): void {
        let initFailure = this.media.getLocalStream().subscribe(null, error => {
            this.view = PadView.Welcome;
            initFailure.unsubscribe();
            initFailure = null;
            if (success) success.unsubscribe();
        });

        // switch the view back once we've calibrated
        let success = this.media.getCalibration().filter(pitch => pitch !== null).take(1).subscribe(pitch => {
            if (this.view === PadView.AudioSetup) {
                this.view = PadView.Welcome;
                if (initFailure) { initFailure.unsubscribe(); }
            }
        });

        this.media.initializeLocal();
        this.view = PadView.AudioSetup;
    }

    isConnected(): boolean { return this.hasPad() && this.getPad().isSignalerConnected(); }

    getUsers(): UserModel[] {
        if (!this.hasPad()) return [];
        return Array.from(this.getPad().getUsers().values());
    }

    /* joining a pad */

    getJoinId() { return this.hasPad() ? this.getPad().getPadId() : this.randomPadId; }
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

}

function hasMethod(type: any, methodName: string): boolean {
    return type && (type[methodName] || (type['prototype'] && type['prototype'][methodName]));
}
