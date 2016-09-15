import {
    Component,
    ElementRef,
    OnDestroy,
    OnChanges,
    Input,
    ViewChild,
    HostBinding,
    NgZone
} from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/operator/throttleTime';

import { VoiceAnalyser } from '../util/VoiceAnalyser';

const MAX_UPDATE_FPS = 45;

@Component({
    selector: 'audio-monitor',
    template: '<monitor-bar #bar></monitor-bar>',
    styleUrls: ['audio-monitor.component.scss']
})
export class AudioMonitorComponent implements OnDestroy, OnChanges {

    @Input() analyser: VoiceAnalyser;
    @Input() vertical: any;
    @ViewChild('bar') bar: ElementRef;
    @HostBinding('class.voice-active') voiceActive: boolean;

    private levelSub: Subscription;
    private voiceDetectedSub: Subscription;

    constructor(
        private zone: NgZone
    ) { }

    ngOnDestroy() {
        this.analyser = null;
        this.ngOnChanges();
    }

    ngOnChanges() {
        if (this.levelSub) {
            this.levelSub.unsubscribe();
            this.levelSub = null;
        }
        if (this.voiceDetectedSub) {
            this.voiceDetectedSub.unsubscribe();
            this.voiceDetectedSub = null;
        }
        if (this.analyser) {
            this.levelSub = this.analyser.getLevel().throttleTime(1000 / MAX_UPDATE_FPS).subscribe(this.onLevel);
            this.voiceDetectedSub = this.analyser.getVoiceDetected().subscribe(this.onVoiceDetected);
        }
    }

    private onLevel = (level: number) => {
        level = Math.max(Math.min(level, 1.0), 0.01); // clamp (since the analyser promises us nothing)
        level = level * (2.0 - level); // ease out looks a litle nicer
        const pct = `${level * 100}%`;
        const vert = this.vertical !== undefined;
        this.bar.nativeElement.style.width = vert ? '100%' : pct;
        this.bar.nativeElement.style.height = vert ? pct : '100%';
    };

    private onVoiceDetected = (voiceIsActive: boolean) => {
        this.voiceActive = voiceIsActive;
    };

}
