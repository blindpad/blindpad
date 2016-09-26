import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/take';
import 'rxjs/add/operator/map';

import { BlindpadService } from './blindpad.service';
import { VoiceAnalyser } from '../util/VoiceAnalyser';
import { PadModel } from './PadModel';
import { getAnimalName } from '../util/Names';
import { PaletteColor, getColor } from '../util/Palette';
import { Chunker, Dechunker } from '../util/Chunker';
import { interval } from '../util/Observables';
import {
    Message,
    ConnectionRequest, ConnectionResponse,
    UserStatusRequest, UserStatusResponse,
    PadUpdate
} from '../signaler/Protocol';

const PEER_CONFIG: RTCConfiguration = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302'
            ]
        }
    ]
};

const DATA_CHANNEL_CONFIG: RTCDataChannelInit = {
    ordered: true
};
const DATA_CHANNEL_NAME = 'bp';
const DATA_CHANNEL_MAX_MESSAGE_SIZE = 60000; // the internet says not to go over 64k with webrtc data channels right now

/**
 * How often should we send proactive heartbeats to another user?
 */
const HEARTBEAT_FREQUENCY_MS = 3000;

/**
 * After how long since our last message should we indicate to the user that this peer is out of contact / unavailable?
 */
const PEER_UNAVAILABLE_MS = 2.2 * HEARTBEAT_FREQUENCY_MS;

/**
 * Any user who hasn't responded within this amount of time is considered fair game to be timed out and killed from the swarm
 */
const PEER_TIMEOUT_MS = 25000;

export class UserModel {

    private closed: boolean;
    private started: boolean;
    private name: BehaviorSubject<string>;
    private color: BehaviorSubject<PaletteColor>;

    private audioStream: BehaviorSubject<MediaStream>;
    private isMuted: BehaviorSubject<boolean>;
    private voiceAnalyser: VoiceAnalyser;

    private messagesOut: Subject<Message>;
    private messagesIn: Subject<Message>;

    private peerCxn: BehaviorSubject<RTCPeerConnection>;
    private channel: BehaviorSubject<RTCDataChannel>;
    private chunker: Chunker;
    private dechunker: Dechunker;

    private broadcastSub: Subscription;
    private heartbeatSub: Subscription;
    private lastMessageTime: number;

    constructor(
        private userId: string,
        private pad: PadModel,
        private blindpadService: BlindpadService
    ) {
        this.color = new BehaviorSubject(getColor(0, true, true));
        this.closed = false;
        this.started = false;
        this.name = new BehaviorSubject(this.isLocalUser() ? getAnimalName() : null);

        this.audioStream = new BehaviorSubject<MediaStream>(null);
        this.isMuted = this.isLocalUser() ? this.blindpadService.mediaService.getIsMuted() : new BehaviorSubject(false);
        this.voiceAnalyser = this.isLocalUser() ? this.blindpadService.mediaService.getLocalAnalyser() : new VoiceAnalyser(this.blindpadService.mediaService.getAudioContext(), this.blindpadService.zone);

        this.messagesOut = new Subject<Message>();
        this.messagesIn = new Subject<Message>();

        this.peerCxn = new BehaviorSubject<RTCPeerConnection>(null);
        this.channel = new BehaviorSubject<RTCDataChannel>(null);
        this.chunker = new Chunker(DATA_CHANNEL_MAX_MESSAGE_SIZE);
        this.dechunker = new Dechunker();

        this.broadcastSub = null;
        this.heartbeatSub = null;
        this.lastMessageTime = null;
    }

    getId(): string { return this.userId; }
    getName(): BehaviorSubject<string> { return this.name; }
    getColor(): BehaviorSubject<PaletteColor> { return this.color; }
    isLocalUser(): boolean { return this.userId === this.pad.getClientId(); }
    isRemoteUser(): boolean { return !this.isLocalUser(); }
    isClosed(): boolean { return this.closed; }
    isStarted(): boolean { return this.started; }

    isUnavailable(): boolean { return this.isRemoteUser() && Date.now() - this.lastMessageTime > PEER_UNAVAILABLE_MS; }
    isTimedOut(): boolean { return this.isRemoteUser() && Date.now() - this.lastMessageTime > PEER_TIMEOUT_MS; }

    getAudioStream(): BehaviorSubject<MediaStream> { return this.audioStream; }
    getIsMuted() { return this.isMuted; }
    setMuted(muted = !this.getIsMuted().value) { this.isMuted.next(!!muted); }
    getVoiceAnalyser(): VoiceAnalyser { return this.voiceAnalyser; }

    /**
     * Get an incoming stream of messages (of the supplied type) from this remote user as they arrive
     */
    getMessagesIn(type: string): Observable<any> { return this.messagesIn.filter(msg => msg.type === type).map(msg => msg.data); }

    /**
     * Get an outgoing stream of messages (of the supplied type) to this remote user as they are sent
     */
    getMessagesOut(type: string): Observable<any> { return this.messagesOut.filter(msg => msg.type === type).map(msg => msg.data); }

    /**
     * Feed this model an incoming message (as if it had arrived from the remote user)
     */
    feedMessage(type: string, data: any) { this.messagesIn.next({ type: type, data: data }); }

    start() {
        if (this.isStarted()) return;
        this.started = true;

        if (this.isLocalUser()) {
            this.pad.log('Local user is: ', this.userId);
            return;
        }

        this.color.next(getColor(this.pad.getUsers() ? this.pad.getUsers().size : 0, true, true));
        this.lastMessageTime = Date.now();

        this.setupSubs();
        this.setupRtc();
    }

    close() {
        if (this.isLocalUser() || this.isClosed() || !this.isStarted()) return;
        this.closed = true;

        this.broadcastSub.unsubscribe();
        this.broadcastSub = null;
        this.heartbeatSub.unsubscribe();
        this.heartbeatSub = null;

        this.messagesOut.complete();
        this.messagesIn.complete();

        this.peerCxn.filter(cxn => !!cxn).take(1).subscribe(cxn => cxn.close());
        this.peerCxn.complete();

        this.channel.filter(channel => !!channel).take(1).subscribe(channel => channel.close());
        this.channel.complete();

        this.audioStream.next(null);
        this.audioStream.complete();
    }

    private isCaller(): boolean { return this.pad.getClientId() > this.userId; }
    private isReceiver(): boolean { return !this.isCaller(); }

    private setupSubs() {
        this.broadcastSub = this.pad.getOutoingUserBroadcasts().subscribe(msg => this.messagesOut.next(msg));
        this.heartbeatSub = interval(HEARTBEAT_FREQUENCY_MS).subscribe(time => {
            this.sendHeartbeatRequest();
        });

        // when the chunker emits a message chunk send it over the channel (when it's ready)
        this.chunker.chunks.subscribe(chunk => {
            this.channel.filter(channel => channel && channel.readyState === 'open').take(1)
                .subscribe(channel => {
                    channel.send(chunk);
                    // console.error('sent ', chunk.length, chunk.substring(0, 20));
                });
        });

        // when the dechunker emits a message send it to our local pipe
        this.dechunker.messages.subscribe(message => {
            this.lastMessageTime = Date.now();
            // console.error('received msg: ', message.length, message.substring(0, 20));
            this.messagesIn.next(JSON.parse(message));
        });

        // when we get a message (that somebody local wants to send) send it off to our chunker
        this.messagesOut
            .filter(message => message.type !== ConnectionRequest.messageType && message.type !== ConnectionResponse.messageType) // these types are sent to the signaler instead of the webrtc channel
            .subscribe(message => {
                const str = JSON.stringify(message);
                this.chunker.messages.next(str);
                // console.error('sent msg: ', str.length, str.substring(0, 20));
            });

        // when we get a cxn request or response feed it to the next available peer socket (which should be hungry for it)  
        this.getMessagesIn(ConnectionRequest.messageType).take(1).subscribe((request: ConnectionRequest) => {
            this.peerCxn.filter(cxn => !!cxn).take(1) // idea: filter on the cxn state instead of taking the first 
                .subscribe(cxn => {
                    cxn.setRemoteDescription(JSON.parse(request.requestBlob));
                    cxn.createAnswer().then(
                        desc => { cxn.setLocalDescription(desc); },
                        error => { console.error('Error creating answer to ', this.userId, error); }
                    );
                });
        });
        this.getMessagesIn(ConnectionResponse.messageType).take(1).subscribe((response: ConnectionResponse) => {
            this.peerCxn.filter(cxn => !!cxn).take(1)
                .subscribe(cxn => {
                    cxn.setRemoteDescription(JSON.parse(response.responseBlob));
                });
        });

        // when we get a heartbeat request we should reply immediately
        this.getMessagesIn(UserStatusRequest.messageType).subscribe((request: UserStatusRequest) => {
            this.sendHeartbeatResponse();
        });
        this.getMessagesIn(UserStatusResponse.messageType).subscribe((response: UserStatusResponse) => {
            if (this.name.value !== response.name) {
                this.pad.log('Received name from ', response.srcId, ' / ', response.name);
                this.name.next(response.name);
            }
            // if we got an update then feed it to ourselves
            if (response.update) this.feedMessage(PadUpdate.messageType, response.update);
        });

        this.audioStream.subscribe(stream => {
            if (this.isLocalUser()) return; // shouldn't happen, but just in case we don't want to screw with the local user's analyser
            this.voiceAnalyser.stop();
            if (stream) {
                const ctx = this.blindpadService.mediaService.getAudioContext();
                this.voiceAnalyser.start(ctx.createMediaStreamSource(stream));
            }
        });
    }

    private setupRtc() {
        const pc = new RTCPeerConnection(PEER_CONFIG);

        pc.onicecandidate = candidate => {
            // Firing this callback with a null candidate indicates that
            // trickle ICE gathering has finished, and all the candidates
            // are now present in pc.localDescription.  Waiting until now
            // to create the offer / answer saves us from having to send offer +
            // answer + iceCandidates separately.
            if (candidate.candidate !== null) return;

            const desc = pc.localDescription;

            if (this.isReceiver()) {
                const res = new ConnectionResponse();
                res.srcId = this.pad.getClientId();
                res.destId = this.userId;
                res.padId = this.pad.getPadId();
                res.responseBlob = JSON.stringify(desc);
                this.messagesOut.next({ type: ConnectionResponse.messageType, data: res });
            } else if (this.isCaller()) {
                const req = new ConnectionRequest();
                req.srcId = this.pad.getClientId();
                req.destId = this.userId;
                req.padId = this.pad.getPadId();
                req.requestBlob = JSON.stringify(desc);
                this.messagesOut.next({ type: ConnectionRequest.messageType, data: req });
            }
        };
        // pc.onsignalingstatechange = event => console.log('cxn [onsignalingstatechange]: ', event);
        // pc.onopen = event => console.log('cxn [onopen]: ', event);

        pc.onaddstream = event => this.audioStream.next(event.stream);

        if (this.blindpadService.mediaService.getLocalStream().value) {
            pc.addStream(this.blindpadService.mediaService.getLocalStream().value);
        }

        const setupChannel = (channel: RTCDataChannel) => {
            channel.onopen = event => this.sendHeartbeatResponse(true);
            // channel.onerror = event => console.error('channel [onerror]: ', this.userId, event);
            channel.onclose = event => console.error('channel [onclose]: ', this.userId, event);
            channel.onmessage = event => {
                this.blindpadService.zone.run(() => { // zonejs didnt think to monkeypatch webrtc
                    const data = event.data as string;
                    // console.error('received ', data.length, data.substring(0, 20));
                    this.dechunker.chunks.next(data);
                });
            };
            this.channel.next(channel);
        };

        if (this.isCaller()) {
            // If you don't make a datachannel *before* making your offer (such
            // that it's included in the offer), then when you try to make one
            // afterwards it just stays in "connecting" state forever.
            setupChannel(pc.createDataChannel(DATA_CHANNEL_NAME, DATA_CHANNEL_CONFIG));
            pc.createOffer().then(
                desc => { pc.setLocalDescription(desc); },
                error => { console.error('Error generating offer to ', this.userId, error); }
            );
        } else if (this.isReceiver()) {
            pc.ondatachannel = event => setupChannel((event as any).channel);
        }

        this.peerCxn.next(pc);
    }

    private sendHeartbeatRequest = () => {
        const req = new UserStatusRequest();
        req.srcId = this.pad.getLocalUser().getId();
        req.destId = this.getId();
        req.padId = this.pad.getPadId();
        this.messagesOut.next({ type: UserStatusRequest.messageType, data: req });
    }

    private sendHeartbeatResponse = (sendPadUpdate = false) => {
        const res = new UserStatusResponse();
        res.srcId = this.pad.getLocalUser().getId();
        res.destId = this.getId();
        res.name = this.pad.getLocalUser().getName().value;
        if (sendPadUpdate) res.update = this.pad.buildPadUpdate(false);
        this.messagesOut.next({ type: UserStatusResponse.messageType, data: res });
    }

}
