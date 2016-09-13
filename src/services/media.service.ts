require('webrtc-adapter');
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import 'rxjs/add/operator/combineLatest';

import { PitchDetector } from '../util/PitchDetector';
import { PitchShifter } from '../util/PitchShifter';
import { VoiceAnalyser } from '../util/VoiceAnalyser';

const DEFAULT_REFERENCE_PITCH: number = 157.5;
const DEBUG_CALIBRATION: number = null; // 115;
const SAVED_CALIBRATION_KEY = 'measuredPitch';

@Injectable()
export class MediaService {

    private audioContext: AudioContext;
    private initialized: boolean;
    private optOut: boolean; // did the user opt out of all local audio?

    // local stream + processing
    private userMedia: MediaStream; // keep the raw media stream around so we can close it if the user wants to
    private localStream: BehaviorSubject<MediaStream>;
    private voiceAnalyser: VoiceAnalyser;
    private shifter: PitchShifter;
    private microphoneNode: MediaStreamAudioSourceNode;
    private destNode: MediaStreamAudioDestinationNode;
    private isMuted: BehaviorSubject<boolean>;

    // pitch detection and calibration 
    private detector: PitchDetector;
    private measuredPitch: BehaviorSubject<number>;
    private calibrationAttempts = 0;
    private storage: Storage = window.sessionStorage; // could also be localstorage
    private calibrationQuality: number;

    constructor(private zone: NgZone) {
        this.audioContext = new (window['AudioContext'] || window['webkitAudioContext'])();
        this.initialized = false;
        this.optOut = false;

        this.userMedia = null;
        this.localStream = new BehaviorSubject(null);
        this.voiceAnalyser = new VoiceAnalyser(this.audioContext, zone);
        this.shifter = new PitchShifter(this.audioContext);
        this.microphoneNode = null;
        this.destNode = null;
        this.isMuted = new BehaviorSubject(false);

        this.detector = new PitchDetector(this.audioContext);
        this.measuredPitch = new BehaviorSubject(DEBUG_CALIBRATION || this.getSavedCalibration());
        this.measuredPitch.subscribe(pitch => {
            console.log('Calibrated: ', pitch); // tslint:disable-line
            if (pitch) {
                this.storage.setItem(SAVED_CALIBRATION_KEY, JSON.stringify(pitch));
            } else {
                this.storage.removeItem(SAVED_CALIBRATION_KEY);
            }
            this.shifter.setPitchScale(pitch > 0 ? DEFAULT_REFERENCE_PITCH / pitch : null);
        });
    }

    initializeLocal() {
        if (this.initialized || this.isOptOut()) return;
        this.initialized = true;

        // if (1 === 1) return; // TODO delete this
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(
            microphone => {
                const ctx = this.audioContext;
                this.userMedia = microphone;
                if (this.isOptOut()) {
                    this.ensureUserMediaClosed();
                    return;
                }
                // two paths through the local audio graph
                // microphone => shifter => deststream
                // microhpone => analyser
                this.microphoneNode = ctx.createMediaStreamSource(microphone);
                this.destNode = ctx.createMediaStreamDestination();
                this.localStream.next(this.destNode.stream);
                this.voiceAnalyser.start(this.microphoneNode);

                // we should mute the local user when either we're explicitly asked to mute // (turned off) or nobody's speaking (to save CPU)
                let isConnected = false; // need this because disconnecting an unconnected node throws an error and we cant introspect in the API
                this.isMuted.combineLatest(this.voiceAnalyser.getVoiceDetected(), (muted, detected) => !muted)// && detected) (disconnecting when voice not detected is too laggy: maybe use a gain node if it ends up noisy in practice?)
                    .subscribe(isEnabled => {
                        if (isEnabled === isConnected) return;
                        const shifterNode = this.shifter.getNode();
                        // need to disconnect both ends of a script processor to get it to stop running
                        if (isEnabled) {
                            this.microphoneNode.connect(shifterNode);
                            shifterNode.connect(this.destNode);
                        } else {
                            this.microphoneNode.disconnect(shifterNode);
                            shifterNode.disconnect(this.destNode);
                        }
                        isConnected = isEnabled;
                    });
            },
            error => {
                this.localStream.next(null);
                this.localStream.error(error);
                this.optOut = true;
            });
    }

    getLocalStream(): BehaviorSubject<MediaStream> { return this.localStream; }
    getAudioContext(): AudioContext { return this.audioContext; }
    getLocalAnalyser(): VoiceAnalyser { return this.voiceAnalyser; }

    setCalibrating(calibrating: boolean) {
        this.localStream.filter(stream => !!stream).take(1).subscribe(() => {
            if (calibrating === this.detector.isRunning()) return; // in case of multiple clicks while waiting for initialization
            if (calibrating) {
                this.measuredPitch.next(null);
                this.calibrationAttempts++;
                this.calibrationQuality = null;
                this.detector.start(this.microphoneNode);
            } else {
                this.detector.stop();
                this.calibrationQuality = this.detector.getEstimateQuality();
                this.measuredPitch.next(this.detector.hasGoodEstimate() ? this.detector.getEstimate() : null);
            }
        });
    }
    isCalibrating() { return this.detector.isRunning(); }
    isCalibrated() { return this.getCalibration().value !== null; }
    needsCalibration() { return !this.isCalibrated() && !this.isOptOut(); }
    getCalibrationAttempts(): number { return this.calibrationAttempts; }
    getCalibration() { return this.measuredPitch; }
    getCalibrationQuality() { return this.calibrationQuality; }

    clearCalibration() {
        if (!this.isCalibrated()) return;
        this.calibrationAttempts = 0;
        this.measuredPitch.next(null);
    }

    setOptOut() {
        this.optOut = true;
        this.ensureUserMediaClosed();
    }
    isOptOut() { return this.optOut; }

    getIsMuted(): BehaviorSubject<boolean> { return this.isMuted; }
    setIsMuted(muted: boolean) { this.isMuted.next(!!muted); }

    getPhrases() {
        return [
            'They ate eight reindeer steaks.',
            'The gauge shows a great change. ',
            'Where is their snake? ',
            'It’s over there in the cage. ',
            'Harry is crazy about the taste of gravy. ',
            'In April the mayor will raise the tax rate. ',
            'I hear that those people are very crazy. ',
            'The scenery here is beyond belief. '// ,
            // 'The submarine goes down deep in the sea with ease. ',
            // 'It’s a relief that you received the seized treat. ',
            // 'Each of these is free.',
            // 'Why did you dye the tie?',
            // 'What is the height of the sign?',
            // 'That type of spy lies all of the time. ',
            // 'The tiny child likes to make designs. ',
            // 'This aisle is twice as wide. ',
            // 'It is nine degrees Fahrenheit on the island. ',
            // 'Soak your toe in this bowl. ',
            // 'When the car jolted, be broke his shoulder. ',
            // 'You need two yolks to make the dough. ',
            // 'Don’t throw the stone at the boat. ',
            // 'He has sewn the mauve robe that is in the bureau. ',
            // 'He borrowed most of the money from his folks so he owes them more than he owns. ',
            // 'Tuesday he will leave for university in Europe. ',
            // 'It is a beautiful view. ',
            // 'My nephews sang a duet. ',
            // 'There is stew on the menu. ',
            // 'If you use the vacuum, you will blow a fuse. ',
            // 'She refused to lower the volume of the music. ',
            // 'She wore a unique costume.'
        ];
    }

    private ensureUserMediaClosed() {
        if (!this.userMedia) return;
        if (this.userMedia.stop) this.userMedia.stop();
        this.userMedia.getVideoTracks().forEach(t => { if (t.stop) t.stop(); });
        this.userMedia.getAudioTracks().forEach(t => { if (t.stop) t.stop(); });
        this.userMedia = null;
    }

    private getSavedCalibration() {
        const saved = this.storage.getItem(SAVED_CALIBRATION_KEY);
        return saved ? JSON.parse(saved) : null;
    }

}
