export const USE_LOCAL_SIGNALER = false;
export const REMOTE_SIGNALER_HOST = 'bpsignaler-rmnoon.rhcloud.com';
export const REMOTE_SIGNALER_PORT = 8443;

/*
 * Phase 1: Peer Discovery
 * 
 * Discover who's in our pad, either by asking a central signaller or
 * (eventually) asking other peers that are known to us.
 */

/**
 * Sent by a client at any time when they suspect there might be more
 * peers to discover on the pad.
 */
export class PeersRequest {
    static messageType = 'PeersRequest';
    /**
     * Who's asking?
     */
    srcId: string;

    /**
     * What pad do I want peers for?
     */
    padId: string;

    /**
     * Optionally: what are some active peers that are already known to me?
     */
    knownActivePeers: string[];

    /**
     * Optionally: what are some dead peers that are already known to me?
     */
    knownDeadPeers: string[];
}

/**
 * Sent by any peer who receives a `PeersRequest`
 */
export class PeersUpdate {
    static messageType = 'PeersUpdate';

    /**
     * Who's updating?
     */
    srcId: string;

    /**
     * What pad are these peers on?
     */
    padId: string;

    /**
     * What are some peers that we know about that are current in the `active` state?
     */
    activePeers: string[];

    /**
     * What are some peers that we know about that have left the pad?
     */
    deadPeers: string[];

    // IDEA: maybe a set for peers that we think might be broken right now?
}

/*
 * Phase 2: Connection negotation.
 * 
 * Try to connect to specific peers in the pad by sending out our connection
 * blob (to either the signaler or other peers) and waiting for responses with
 * other peers' connection blob.
 */

// IDEA: make connection requests / responses plural by default

/**
 * Sent by a client who's trying to connect to the supplied peer.
 */
export class ConnectionRequest {
    static messageType = 'ConnectionRequest';

    /**
     * Who's sending the message and asking for the connection?
     */
    srcId: string;

    /**
     * Who are we asking to connect to?
     */
    destId: string;

    /**
     * What pad is the sender/receiver on?
     */
    padId: string;

    /**
     * The blob that we need to pass to the peer we want to connect to.
     */
    requestBlob: string;
}

/**
 * Sent by a peer who's responding to a connection request.
 */
export class ConnectionResponse {
    static messageType = 'ConnectionResponse';

    /**
     * Who's sending the message (and responding to the connection request)?
     */
    srcId: string;

    /**
     * Who's connection request are we responding to?
     */
    destId: string;

    /**
     * What pad is the sender/receiver on?
     */
    padId: string;

    /**
     * The blob that the connection requester needs to complete the connection.
     */
    responseBlob: string;
}

/*
 * Phase 3: Pad syncing
 * TODO: explain how it works
 */

export class PadUpdate {
    static messageType = 'PadUpdate';

    /**
     * Who's sending this update?
     */
    srcId: string;

    /**
     * What pad is this update about?
     */
    padId: string;

    /**
     * (optional) If known: what kind of text is being edited on this pad?
     */
    mimeType: string;

    /**
     * (optional) Where do we think are the cursors of various users on the pad?
     */
    cursors: CursorMap;

    /**
     * (optional) What is the latest version of the pad that we all agreed on? 
     */
    base: string;

    /**
     * (optional) How many times has this swarm updated the base version?
     */
    baseVersion: number;

    /**
     * (optional) A compressed representation of the set of operations that have been applied to the base
     * since the last time we all agreed on a base version?
     */
    opSetStr: string;
}

export class UserStatusRequest {
    static messageType = 'UserStatusRequest';

    /**
     * Who's sending this request for an update?'
     */
    srcId: string;

    /**
     * Who are we asking for a response from?
     */
    destId: string;

    /**
     * What pad is this a request for an update on?
     */
    padId: string;
}

export class UserStatusResponse {
    static messageType = 'UserStatusResponse';

    /**
     * Who's sending this message (and thus responding to the status request)?
     */
    srcId: string;

    /**
     * Whose request are we responding to?
     */
    destId: string;

    /**
     * What user-facing name am I using?
     */
    name: string;

    /**
     * Which pad are we responding about?
     */
    padId: string;

    /**
     * (optional) What is the current state of my pad?
     */
    update: PadUpdate;
}

export class PadEdit {

    /**
     * Otherwise a delete
     */
    isInsert: boolean;

    /**
     * The absolute index within the document
     */
    index: number;

    /**
     * The string that's being added or deleted
     */
    text: string;
}

export class Cursor {

    /**
     * Whose cursor is it?
     */
    srcId: string;

    /**
     * Where does it start?
     * - null means there is no selection
     * - start and end will be the same if there's no selection
     */
    startIndex: number;

    /**
     * Where does it end?
     * - null means there is no selection
     * - start and end will be the same if there's no selection
     */
    endIndex: number;
}

export type CursorMap = { [key: string]: Cursor };

export interface Message {
    type: string;
    data: any;
}

/**
 * Returns null if we should use the same domain as we're being served on.
 */
export function getSignalerURI(): string {
    return `${getSignalerProtocol()}://${getSignalerHost()}:${getSignalerPort()}/bp`;
}

export function getSignalerHost(): string {
    if (process.env.NODE_IP) return process.env.NODE_IP;
    return USE_LOCAL_SIGNALER ? '127.0.0.1' : REMOTE_SIGNALER_HOST;
}

export function getSignalerPort(): number {
    if (process.env.NODE_PORT) return process.env.NODE_PORT;
    return USE_LOCAL_SIGNALER ? 3000 : REMOTE_SIGNALER_PORT;
}

export function getSignalerProtocol(): string {
    return USE_LOCAL_SIGNALER ? 'http' : 'https';
}
