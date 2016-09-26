import {
    Component,
    Input,
    OnChanges,
    OnDestroy,
    ElementRef,
    ViewChild
} from '@angular/core';
import { Subscription } from 'rxjs/Subscription';

import { PaletteColor, PRIMARY } from '../util/Palette';
import { UserModel } from '../services/UserModel';

require('../assets/volume_up.png');
require('../assets/volume_down.png');
require('../assets/volume_muted.png');
require('../assets/mic_up.png');
require('../assets/mic_down.png');
require('../assets/mic_muted.png');

@Component({
    selector: 'user',
    templateUrl: 'user.component.html',
    styleUrls: ['user.component.scss']
})
export class UserComponent implements OnChanges, OnDestroy {

    @Input() model: UserModel;
    @ViewChild('audio') audioElem: ElementRef;

    public voiceIsActive: boolean;
    public initials: string;
    public name: string;
    public color: PaletteColor;
    public connected: boolean;

    private streamSub: Subscription;
    private muteSub: Subscription;
    private voiceDetectedSub: Subscription;
    private nameSub: Subscription;
    private colorSub: Subscription;

    ngOnDestroy() {
        this.model = null;
        this.ngOnChanges();
    }

    ngOnChanges() {
        if (this.streamSub) {
            this.streamSub.unsubscribe();
            this.streamSub = null;
        }
        if (this.muteSub) {
            this.muteSub.unsubscribe();
            this.muteSub = null;
        }
        if (this.voiceDetectedSub) {
            this.voiceDetectedSub.unsubscribe();
            this.voiceDetectedSub = null;
        }
        if (this.nameSub) {
            this.nameSub.unsubscribe();
            this.nameSub = null;
        }
        if (this.colorSub) {
            this.colorSub.unsubscribe();
            this.colorSub = null;
        }
        this.voiceIsActive = false;
        this.initials = '';
        this.name = '';
        this.color = PRIMARY.RED;
        this.connected = false;

        if (!this.model) return;

        this.colorSub = this.model.getColor().subscribe(color => this.color = color);
        this.nameSub = this.model.getName().subscribe(name => {
            if (this.model.isLocalUser()) {
                this.name = name ? name : 'Local';
                this.initials = 'YOU';
                this.connected = true;
            } else if (name === null) {
                this.name = '';
                this.initials = '';
                this.connected = false;
            } else {
                this.name = name !== null ? name : '';
                this.initials = name !== null ? getInitials(this.name) : '';
                this.connected = true;
            }
        });

        if (this.model.isRemoteUser()) {
            this.streamSub = this.model.getAudioStream().subscribe(stream => {
                this.audioElem.nativeElement.srcObject = stream; // somehow srcObject not in typings for HTMLAudioElement
            });
            this.muteSub = this.model.getIsMuted().subscribe(muted => {
                (this.audioElem.nativeElement as HTMLAudioElement).muted = muted;
            });
        }

        this.voiceDetectedSub = this.model.getVoiceAnalyser().getVoiceDetected().subscribe(detected => {
            this.voiceIsActive = detected;
            // if (this.model.isRemoteUser()) {
            //     // mute remote users when they're not speaking to cut down on echo
            //     // (this.audioElem.nativeElement as HTMLAudioElement).volume = detected ? 1.0 : 0.0;
            // }
        });
    }

    getTitle(): string {
        if (!this.connected) return 'Connecting...';
        if (this.model.isUnavailable()) return 'Currently unavailable';
        return this.name;
    }

}

function getInitials(str: string) {
    return str
        .replace(/([A-Z])/g, ' $1') // insert a space before all caps
        .replace(/^./, s => s.toUpperCase()) // uppercase the first character
        .split(' ') // break apart by space
        .map(s => s.charAt(0)) // get first letter
        .join('') // stitch back together
        .substring(0, 2); // at most 2
}
