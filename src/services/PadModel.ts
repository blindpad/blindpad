import uuid = require('node-uuid');
import io = require('socket.io-client');
import { Subject } from 'rxjs/Subject';
import { Observer } from 'rxjs/Observer';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Subscription } from 'rxjs/Subscription';

import { KSeq, Op } from '../kseq';
import {
    getSignalerURI,
    Message,
    PeersRequest, PeersUpdate,
    ConnectionRequest, ConnectionResponse,
    PadEdit, PadUpdate,
    CursorMap
} from '../signaler/Protocol';
import { UserModel } from './UserModel';
import { BlindpadService } from './blindpad.service';
import { compressOpSet, decompressOpSet } from '../util/Compress';
import { diffStrings, DIFF_DELETE, DIFF_INSERT } from '../util/Diff';
import { interval } from '../util/Observables';
import { SeededRandom } from '../util/Random';
import { debounce } from '../util/Debounce';

/**
 * After how many milliseconds without an edit can we trigger a pad compaction (assuming all other conditions are met?)
 */
const COMPACTION_DELAY_MS = 4000;

const PEER_TIMEOUT_POLL_MS = 5000;
const COMPACTION_POLL_MS = 1000;

export class PadModel {
    private useLog = true;

    private clientId: string;
    private signaler: SocketIOClient.Socket;
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
    private mostRecentCursors: CursorMap;
    private lastEditTime: number;

    private outgoingUserBroadcasts: Subject<Message>;

    private localEdits: Subject<PadEdit[]>;
    private remoteEdits: Subject<PadEdit[]>;
    private localCursors: Subject<CursorMap>;
    private remoteCursors: Subject<CursorMap>;

    private debouncedPadUpdate: () => void;
    private debouncedIsLightweight = true;

    private peerTimeoutSub: Subscription;
    private compactionSub: Subscription;

    constructor(
        private padId: string,
        private blindpadService: BlindpadService
    ) {
        this.clientId = uuid.v1();

        this.activePeers = new Set<string>();
        this.deadPeers = new Set<string>();

        this.users = new Map<string, UserModel>();

        this.mimeType = new BehaviorSubject(null);
        this.mostRecentCursors = null;

        this.outgoingUserBroadcasts = new Subject<Message>();
        this.localEdits = new Subject<PadEdit[]>();
        this.remoteEdits = new Subject<PadEdit[]>();
        this.localCursors = new Subject<CursorMap>();
        this.remoteCursors = new Subject<CursorMap>();

        this.localEdits.subscribe(this.onLocalEdits);
        this.localCursors.subscribe(this.onLocalCursors);

        this.localEdits.subscribe(edits => this.lastEditTime = Date.now());
        this.remoteEdits.subscribe(edits => this.lastEditTime = Date.now());

        this.activePeers.add(this.clientId);
        this.updateUsers([], []);
        this.setBaseDoc('', 0);
    }

    getPadId(): string { return this.padId; }
    getClientId(): string { return this.clientId; }
    getLocalUser(): UserModel { return this.users.get(this.clientId); }
    getUsers(): Map<string, UserModel> { return this.activeUsers; }
    getAllUsers(): Map<string, UserModel> { return this.users; }
    log(...msg: any[]) { if (this.useLog) console.log('', ...msg); } // tslint:disable-line

    isSignalerConnected(): boolean { return this.signaler && this.signaler.connected; }
    getOutoingUserBroadcasts(): Observable<Message> { return this.outgoingUserBroadcasts; }
    getLocalEdits(): Observer<PadEdit[]> { return this.localEdits; }
    getRemoteEdits(): Observable<PadEdit[]> { return this.remoteEdits; }
    getLocalCursors(): Observer<CursorMap> { return this.localCursors; }
    getRemoteCursors(): Observable<CursorMap> { return this.remoteCursors; }

    getMimeType(): BehaviorSubject<string> { return this.mimeType; }
    setMimeType(mime: string) { if (mime !== this.mimeType.value) this.mimeType.next(mime); }

    buildPadUpdate(isLightweight = true): PadUpdate {
        const update = new PadUpdate();
        update.srcId = this.clientId;
        update.padId = this.padId;
        if (this.mimeType.value) update.mimeType = this.mimeType.value;
        if (this.mostRecentCursors) update.cursors = this.mostRecentCursors;

        if (!isLightweight) {
            update.base = this.base;
            update.baseVersion = this.baseVersion;

            if (this.memoizedOpSetStr === null) {
                this.memoizedOpSetStr = compressOpSet(this.opSet);
            }
            update.opSetStr = this.memoizedOpSetStr;
        }

        return update;
    }

    start() {
        if (this.isStarted()) return; // already started
        const signalerURI = getSignalerURI();
        this.log('Looking for signaler: ', signalerURI);
        this.signaler = io.connect(signalerURI);
        this.remoteEdits.next([]); // kind of a hack, tells the editor that we're starting
        this.setMimeType(null);

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
            if (type) this.firePadUpdate(true);
        });

        this.peerTimeoutSub = interval(PEER_TIMEOUT_POLL_MS).subscribe(this.onPeerTimeoutTick);
        this.compactionSub = interval(COMPACTION_POLL_MS).subscribe(this.onCompactionTick);
    }

    close() {
        if (!this.isStarted()) return;
        this.killUsersAndSignal([this.clientId]);
        this.users.forEach(user => { user.close(); });
        this.users.clear();

        if (this.signaler) this.signaler.close();

        this.mimeType.complete();
        this.localEdits.complete();
        this.remoteEdits.complete();
        this.localCursors.complete();
        this.remoteCursors.complete();

        this.peerTimeoutSub.unsubscribe();
        this.compactionSub.unsubscribe();
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
                    if (!user.isClosed()) {
                        user.close();
                        // make sure to clear the cursor of anyone we see die
                        const tombstoneCursor: CursorMap = {};
                        tombstoneCursor[peerId] = null;
                        this.remoteCursors.next(tombstoneCursor);
                    }
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
            this.firePadUpdate(false);
        }
    };

    private onPadUpdate = (update: PadUpdate) => {
        if (update.mimeType !== undefined && update.mimeType !== this.mimeType.value) {
            this.mimeType.next(update.mimeType);
        }

        if (update.base !== undefined && update.baseVersion !== undefined && update.opSetStr !== undefined) {
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
                this.setBaseDoc(update.base, update.baseVersion);
                this.applyOpsAndRender(decompressOpSet(update.opSetStr));
            } else if (this.baseVersion === update.baseVersion && this.base !== update.base) {
                // we must've had a split compaction (two people thought they were the master and advanced)
                if (update.srcId > this.clientId) {
                    // accept the bigger client's view of reality
                    this.setBaseDoc(update.base, update.baseVersion);
                    this.applyOpsAndRender(decompressOpSet(update.opSetStr));
                }
            }
        }

        if (update.cursors !== undefined) {
            const newCursors: CursorMap = {};
            Object.keys(update.cursors || {}).forEach(userId => {
                const cursor = update.cursors[userId];
                // ignore the cursor if they're not alive
                if (!this.activeUsers.has(userId)) return;
                // ignore ours (this is only for remote cursors: we trust ourselves to know our own cursor)
                if (userId === this.clientId) return;

                // we could either take every cursor with every update
                // or we could only update the ones coming authoritatively from the sender
                // of the update and allow the pad changes / codemirror logic to do the rest.
                // we're going to do the latter for now
                if (userId === update.srcId) {
                    newCursors[userId] = cursor;
                }
            });
            this.remoteCursors.next(newCursors);
        }

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

    private onLocalCursors = (cursors: CursorMap) => {
        this.mostRecentCursors = cursors;
        this.firePadUpdate(true);
    };

    /**
     * Broadcast an update in our version of the pad to other users: to save on bandwidth
     * calls to this will be debounced based on the size of the current opSet (which dominates the
     * size of the message).
     */
    private firePadUpdate(isLightweight: boolean) {
        this.debouncedIsLightweight = !!this.debouncedIsLightweight && isLightweight;

        if (!this.debouncedPadUpdate) {
            const delay = 25 * Math.pow(Math.log10(this.opSet.size + 1), 2);
            this.debouncedPadUpdate = debounce(() => {
                this.sendUpdateNow(this.debouncedIsLightweight);
                this.debouncedPadUpdate = null;
                this.debouncedIsLightweight = true;
            }, delay);
        }
        this.debouncedPadUpdate();
    }

    private sendUpdateNow(isLightweight: boolean) {
        this.outgoingUserBroadcasts.next({ type: PadUpdate.messageType, data: this.buildPadUpdate(isLightweight) });
    }

    private onCompactionTick = () => {
        // if (1 === 1) return; // disble compaction
        // conditions under which we should broadcast a compaction:
        // we're not dead
        if (!this.activePeers.has(this.clientId)) return;
        // we have an opset
        if (this.opSet.size === 0) return;
        // we're the largest client id in the swarm (kind of a janky master)
        if (!this.isLargestPeer()) return;
        // we're either by ourself or we have at least one responsive peer (i.e. we're not totally isolated from the swarm)
        if (this.activePeers.size > 1 && this.getResponsivePeers().length === 0) return;
        // it's been more than a certain fixed amount of time since the last pad edit
        if (Date.now() - this.lastEditTime < COMPACTION_DELAY_MS) return;

        this.setBaseDoc(this.doc.toArray().join(''), this.baseVersion + 1);
        this.sendUpdateNow(false);
    };

    private onPeerTimeoutTick = () => {
        // conditions under which we should broadcast timed out peers as dead
        // we're not dead
        if (!this.activePeers.has(this.clientId)) return;
        // we have peers
        if (this.activePeers.size < 2) return;
        // at least one of them is timed out
        if (this.getTimedOutPeers().length === 0) return;

        // we can hit the network (to ensure we're not isolated)
        const req = new XMLHttpRequest();
        req.onreadystatechange = () => {
            if (req.readyState !== XMLHttpRequest.DONE || req.status !== 200) return;
            // we know we're online
            const timedOutIds = this.getTimedOutPeers().map(user => user.getId());
            if (timedOutIds.length > 0) this.killUsersAndSignal(timedOutIds);
        };
        req.timeout = PEER_TIMEOUT_POLL_MS / 2;
        req.open('GET', `/index.html?t=${Date.now()}`, true); // prevent caching
        req.send();
    }

    private getResponsivePeers(): Array<UserModel> {
        return Array.from(this.activeUsers.values()).filter(user => user.isRemoteUser() && !user.isUnavailable());
    }

    private getTimedOutPeers(): Array<UserModel> {
        return Array.from(this.activeUsers.values()).filter(user => user.isRemoteUser() && user.isTimedOut());
    }

    private isLargestPeer(): boolean {
        return this.clientId !== Array.from(this.activePeers).reduce((prev, cur) => cur > prev ? cur : prev);
    }

    private killUsersAndSignal(peerIds: Array<string>) {
        this.updateUsers([], peerIds);
        const update = new PeersUpdate();
        update.padId = this.padId;
        update.srcId = this.clientId;
        update.activePeers = Array.from(this.activePeers.values());
        update.deadPeers = Array.from(this.deadPeers.values());
        this.signaler.emit(PeersUpdate.messageType, update);
    }

    private setBaseDoc(base: string, version: number) {
        const oldVersion = this.doc ? this.doc.toArray().join('') : '';
        this.base = base;
        this.baseVersion = version;
        this.doc = new KSeq<string>(this.clientId.substring(0, 6)); // this is probably way too collision-happy
        this.opSet = new Set<string>();

        // for correctness our "base" text" just implies a set of operations
        // that all peers agree on (in this case made by a simulated third party)
        const rng = new SeededRandom(version);
        const baseDoc = new KSeq<string>('' + version, () => version, () => rng.random());
        for (let i = 0, l = base.length; i < l; i++) {
            this.doc.apply(baseDoc.insert(base.charAt(i), i));
        }
        this.memoizedOpSetStr = null;
        this.lastEditTime = Date.now();

        // if post-compaction the doc has changed flush the new version of the doc as remove+insert edits
        if (oldVersion !== this.base) {
            const remove = new PadEdit();
            remove.index = 0;
            remove.isInsert = false;
            remove.text = oldVersion;
            const add = new PadEdit();
            add.index = 0;
            add.isInsert = true;
            add.text = this.base;
            this.remoteEdits.next([remove, add]);
        }
    }

    private signalRequest = (req: ConnectionRequest) => {
        this.signaler.emit(ConnectionRequest.messageType, req);
    };

    private signalResponse = (res: ConnectionResponse) => {
        this.signaler.emit(ConnectionResponse.messageType, res);
    };

    private isValidMessage(msg: PeersRequest | PeersUpdate | ConnectionRequest | ConnectionResponse): boolean {
        if (msg.padId !== this.padId) {
            console.log(`Message padId (${msg.padId}) doesn't match local padId: ${this.padId}, ignoring...`); // tslint:disable-line
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
