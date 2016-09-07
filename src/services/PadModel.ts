import uuid = require('node-uuid');
import io = require('socket.io-client');
// import jsdiff = require('diff');
import * as _ from 'lodash';
import { Subject } from 'rxjs/Subject';
import { Observer } from 'rxjs/Observer';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import { KSeq, Op } from '../kseq';
import { getSignalerURI, PeersRequest, PeersUpdate, ConnectionRequest, ConnectionResponse, PadEdit, PadUpdate, Message } from '../signaler/Protocol';
import { UserModel } from './UserModel';
import { BlindpadService } from './blindpad.service';
import { compressOpSet, decompressOpSet } from '../util/Compress';
import { diffStrings, DIFF_DELETE, DIFF_INSERT } from '../util/Diff';

export class PadModel {
    private useLog = true;
    private signaler: SocketIOClient.Socket;

    private clientId: string;

    private activePeers: Set<string>;
    private deadPeers: Set<string>;

    private users: Map<string, UserModel>;
    private activeUsers: Map<string, UserModel>;

    private mimeType: BehaviorSubject<string>;
    private doc: KSeq<string>;
    private base: string;
    private baseVersion: number;
    private opSet: Set<string>;
    private memoizedOpSetStr: string;

    private outgoingUserBroadcasts: Subject<Message>;
    private localEdits: Subject<PadEdit[]>;
    private remoteEdits: Subject<PadEdit[]>;

    private delayedPadBroadcast: () => void;

    // private deadUserCheckSub: Subscription;

    constructor(
        private padId: string,
        private blindpadService: BlindpadService
    ) {
        this.clientId = uuid.v1();

        this.activePeers = new Set<string>();
        this.deadPeers = new Set<string>();

        this.users = new Map<string, UserModel>();

        this.mimeType = new BehaviorSubject(null);
        this.doc = new KSeq<string>(this.clientId.substring(0, 6)); // this is probably way too collision-happy
        this.base = '';
        this.baseVersion = 0;
        this.opSet = new Set<string>();
        this.memoizedOpSetStr = null;

        this.outgoingUserBroadcasts = new Subject<Message>();
        this.localEdits = new Subject<PadEdit[]>();
        this.remoteEdits = new Subject<PadEdit[]>();
        this.localEdits.subscribe(this.onLocalEdits);

        this.activePeers.add(this.clientId);
        this.updateUsers([], []);
    }

    getPadId(): string { return this.padId; }
    getClientId(): string { return this.clientId; }
    getLocalUser(): UserModel { return this.users.get(this.clientId); }
    getUsers(): Map<string, UserModel> { return this.activeUsers; }
    getAllUsers(): Map<string, UserModel> { return this.users; }
    log(...msg: any[]) { if (this.useLog) console.log('', ...msg); } // tslint:disable-line

    getOutoingUserBroadcasts(): Observable<Message> { return this.outgoingUserBroadcasts; }
    getLocalEdits(): Observer<PadEdit[]> { return this.localEdits; }
    getRemoteEdits(): Observable<PadEdit[]> { return this.remoteEdits; }
    getContents(): string { return this.doc.toArray().join(''); }

    getMimeType(): BehaviorSubject<string> { return this.mimeType; }
    setMimeType(mime: string) { if (mime !== this.mimeType.value) this.mimeType.next(mime); }

    buildPadUpdate(): PadUpdate {
        const update = new PadUpdate();
        update.padId = this.padId;
        if (this.mimeType.value) update.mimeType = this.mimeType.value;
        update.srcId = this.clientId;
        update.base = this.base;
        update.baseVersion = this.baseVersion;

        if (this.memoizedOpSetStr === null) {
            this.memoizedOpSetStr = compressOpSet(this.opSet);
        }
        update.opSetStr = this.memoizedOpSetStr;

        return update;
    }

    start() {
        if (this.isStarted()) return; // already started
        const signalerURI = getSignalerURI();
        this.log('Looking for signaler: ', signalerURI);
        this.signaler = io.connect(signalerURI);
        this.remoteEdits.next([]); // kind of a hack, tells the editor that we're starting

        this.signaler.on('connect', () => {
            this.log('Connected to signaler, asking for peers!');
            const req = new PeersRequest();
            req.padId = this.padId;
            req.srcId = this.clientId;
            req.knownActivePeers = Array.from(this.activePeers.values());
            req.knownDeadPeers = Array.from(this.deadPeers.values());
            this.signaler.emit(PeersRequest.messageType, req);
        });

        this.signaler.on(PeersRequest.messageType, (data: PeersRequest) => {
            this.log(PeersRequest.messageType, data);
            if (!this.isValidMessage(data)) return;

            this.updateUsers(data.knownActivePeers, data.knownDeadPeers);

            // TODO: don't send response if they knew the same or more than us

            const update = new PeersUpdate();
            update.padId = this.padId;
            update.srcId = this.clientId;
            update.activePeers = Array.from(this.activePeers.values());
            update.deadPeers = Array.from(this.deadPeers.values());

            this.signaler.emit(PeersUpdate.messageType, update);
        });

        this.signaler.on(PeersUpdate.messageType, (data: PeersUpdate) => {
            this.log(PeersUpdate.messageType, data);
            if (!this.isValidMessage(data)) return;

            this.updateUsers(data.activePeers, data.deadPeers);
        });

        this.signaler.on(ConnectionRequest.messageType, (data: ConnectionRequest) => {
            this.log(ConnectionRequest.messageType, data);
            if (!this.isValidConnectionMessage(data)) return;

            this.users.get(data.srcId).feedMessage(ConnectionRequest.messageType, data);
        });

        this.signaler.on(ConnectionResponse.messageType, (data: ConnectionResponse) => {
            this.log(ConnectionResponse.messageType, data);
            if (!this.isValidConnectionMessage(data)) return;

            this.users.get(data.srcId).feedMessage(ConnectionResponse.messageType, data);
        });

        this.signaler.on('DEBUG', (data: any) => { this.log('DEBUG (signaler): ', data); });
        this.signaler.on('disconnect', () => { this.log('disconnected from signaler'); });

        this.mimeType.subscribe(type => {
            if (type) this.broadcastPadUpdate();
        });
    }

    close() {
        if (!this.isStarted()) return;
        this.updateUsers([], [this.clientId]);
        const update = new PeersUpdate();
        update.padId = this.padId;
        update.srcId = this.clientId;
        update.activePeers = Array.from(this.activePeers.values());
        update.deadPeers = Array.from(this.deadPeers.values());
        this.signaler.emit(PeersUpdate.messageType, update);

        this.users.forEach(user => { user.close(); });
        this.users.clear();

        if (this.signaler) {
            this.signaler.close();
        }

        this.localEdits.complete();
        this.remoteEdits.complete();
        this.mimeType.complete();
    }

    isStarted(): boolean {
        return !!this.signaler;
    }

    /* private methods */

    private updateUsers(actives: string[], deads: string[]) {
        // process any new peer information in the request
        actives.forEach(activeId => {
            // old news
            if (this.deadPeers.has(activeId)) {
                return;
            }
            this.activePeers.add(activeId);
        });
        deads.forEach(deadId => {
            if (this.activePeers.has(deadId)) {
                this.activePeers.delete(deadId);
            }
            this.deadPeers.add(deadId);
        });

        const oldUsers = this.users;
        this.users = new Map<string, UserModel>();
        this.activeUsers = new Map<string, UserModel>();
        [this.activePeers, this.deadPeers].forEach(set => {
            set.forEach(peerId => {
                let user = oldUsers.get(peerId);
                if (!user) {
                    user = new UserModel(peerId, this, this.blindpadService);
                    if (this.activePeers.has(peerId)) {
                        user.getMessagesOut(ConnectionRequest.messageType).subscribe(this.signalRequest);
                        user.getMessagesOut(ConnectionResponse.messageType).subscribe(this.signalResponse);
                        user.getMessagesIn(PadUpdate.messageType).subscribe(this.onPadUpdate);
                    }
                }
                this.users.set(peerId, user);
                if (this.activePeers.has(peerId)) {
                    this.activeUsers.set(peerId, user);
                    if (!user.isStarted()) user.start();
                }
                if (this.deadPeers.has(peerId)) {
                    if (!user.isClosed()) user.close();
                }
            });
        });
    }

    private onLocalEdits = (edits: PadEdit[]) => {
        if (!edits || edits.length === 0) return;
        const newOps: Op[] = [];
        edits.forEach(edit => {
            const text = edit.text;
            const idx = edit.index;
            if (edit.isInsert) {
                for (let i = text.length - 1; i >= 0; i--) {
                    const op = this.doc.insert(text.charAt(i), idx);
                    newOps.push(op);
                }
            } else {
                for (let i = 0, l = text.length; i < l; i++) {
                    const op = this.doc.remove(idx);
                    newOps.push(op);
                }
            }
        });
        if (newOps.length > 0) {
            newOps.forEach(op => this.opSet.add(op.toString()));
            this.memoizedOpSetStr = null; // clear a saved value since we changed the canonical one

            // we should only fire the pad broadcast after the user stops typing
            if (!this.delayedPadBroadcast) {
                // the bigger the opset the longer we should let people
                const delay = 25 * Math.pow(Math.log10(this.opSet.size + 1), 2);
                this.delayedPadBroadcast = _.debounce(() => {
                    this.broadcastPadUpdate();
                    this.delayedPadBroadcast = null;
                }, delay);
            }
            this.delayedPadBroadcast();
        }
    };

    private onPadUpdate = (update: PadUpdate) => {
        if (update.mimeType && update.mimeType !== this.mimeType.value) {
            this.mimeType.next(update.mimeType);
        }

        if (this.base === update.base && this.baseVersion === update.baseVersion) {
            // regular update: we agree on base and version, let's just combine our ops and be done
            const opsToApply: string[] = [];
            const haveUpdate = !!update.opSetStr;
            const sameAsMemoized = this.memoizedOpSetStr && this.memoizedOpSetStr === update.opSetStr;
            if (haveUpdate && !sameAsMemoized) {
                decompressOpSet(update.opSetStr).forEach(op => {
                    if (!this.opSet.has(op)) opsToApply.push(op);
                });
            }
            this.applyOpsAndRender(opsToApply);
        } else if (update.baseVersion > this.baseVersion) {
            // remote is newer, blow ours away
            this.log(`Overwriting local doc: remote version is ${update.baseVersion} and we are ${this.baseVersion}`);
            this.base = update.base;
            this.baseVersion = update.baseVersion;
            this.opSet = new Set<string>();
            this.applyOpsAndRender(decompressOpSet(update.opSetStr));
        }

        // TODO: still the case where we have the same version but different bases: maybe the older client should win?
    };

    private applyOpsAndRender(ops: string[]) {
        ops = ops || [];
        if (ops.length === 0) return;
        const oldVersion = this.doc.toArray().join('');
        let numApplied = 0;
        ops.forEach(op => {
            if (this.opSet.has(op)) return;
            this.doc.apply(Op.parse(op));
            this.opSet.add(op);
            numApplied++;
        });
        if (numApplied === 0) return;
        const newVersion = this.doc.toArray().join('');
        const versionDiff = diffStrings(oldVersion, newVersion);
        let idx = 0;
        const edits: PadEdit[] = [];
        versionDiff.forEach(([type, value]) => {
            if (type === DIFF_INSERT) {
                const insert = new PadEdit();
                insert.index = idx;
                insert.isInsert = true;
                insert.text = value;
                edits.push(insert);
            } else if (type === DIFF_DELETE) {
                const remove = new PadEdit();
                remove.index = idx;
                remove.isInsert = false;
                remove.text = value;
                edits.push(remove);
            }
            if (type !== DIFF_DELETE) idx += value.length;
        });
        if (edits.length > 0) this.remoteEdits.next(edits);
    }

    private broadcastPadUpdate() {
        this.outgoingUserBroadcasts.next({ type: PadUpdate.messageType, data: this.buildPadUpdate() });
    }

    private signalRequest = (req: ConnectionRequest) => {
        this.signaler.emit(ConnectionRequest.messageType, req);
    };

    private signalResponse = (res: ConnectionResponse) => {
        this.signaler.emit(ConnectionResponse.messageType, res);
    };

    private isValidMessage(msg: PeersRequest | PeersUpdate | ConnectionRequest | ConnectionResponse): boolean {
        if (msg.padId !== this.padId) {
            console.log(`Message padId (${msg.padId}) doesn't match local padId: ${this.padId}, ingoring...`); // tslint:disable-line
            return false;
        }
        return true;
    }

    private isValidConnectionMessage(msg: ConnectionRequest | ConnectionResponse): boolean {
        if (!this.isValidMessage(msg)) return false;

        if (!msg.destId || msg.destId !== this.clientId) {
            this.log('destId missing or not for us, ignoring...');
            return false;
        }
        if (!msg.srcId) {
            this.log('srcId missing, ignoring...');
            return false;
        }
        if (!this.activePeers.has(msg.srcId)) {
            this.log(`srcId ${msg.srcId} not an active peer, ignoring...`);
            return false;
        }
        return true;
    }

}
