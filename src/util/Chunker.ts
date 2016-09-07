import { Subject } from 'rxjs/Subject';

const HEADER_SEPARATOR = '|';
const FIELD_SEPARATOR = ',';

/**
 * For every incoming message emit one more more chunks
 */
export class Chunker {

    messages: Subject<string>;
    chunks: Subject<string>;

    constructor(private chunkSize: number) {
        this.messages = new Subject<string>();
        this.chunks = new Subject<string>();
        this.messages.subscribe(this.onMessage);
    }

    private onMessage = (msg: string) => {
        const chunkSize = this.chunkSize;
        const length = msg.length;
        const numChunks = Math.ceil(length / chunkSize);
        const msgId = Date.now().toString();

        for (let chunkNum = 0; chunkNum < numChunks; chunkNum++) {
            let start = chunkNum * chunkSize;
            const chunk = msg.substring(start, start + Math.min(chunkSize, length - start));
            this.chunks.next(`${msgId}${FIELD_SEPARATOR}${chunkNum}${FIELD_SEPARATOR}${numChunks}${HEADER_SEPARATOR}${chunk}`);
        }
    };

}

/**
 * For every incoming chunk interpret the header and (if we have all the chunks) emit a message
 */
export class Dechunker {

    messages: Subject<string>;
    chunks: Subject<string>;

    private buffer: Map<string, MessageRecord>;

    constructor() {
        this.messages = new Subject<string>();
        this.chunks = new Subject<string>();
        this.buffer = new Map<string, MessageRecord>();
        this.chunks.subscribe(this.onChunk);
    }

    private onChunk = (chunk: string) => {
        const headerEndIdx = chunk.indexOf(HEADER_SEPARATOR);
        const header = chunk.substring(0, headerEndIdx);
        const [msgId, chunkNumStr, numChunksStr] = header.split(FIELD_SEPARATOR, 3);
        const chunkBody = chunk.substring(headerEndIdx + 1);
        if (!this.buffer.has(msgId)) {
            this.buffer.set(msgId, new MessageRecord(Number(numChunksStr)));
        }
        const record = this.buffer.get(msgId);
        record.addChunk(Number(chunkNumStr), chunkBody);
        if (record.isComplete()) {
            this.buffer.delete(msgId);
            this.messages.next(record.getMessage());
        }
    }

}

class MessageRecord {
    private received = new Map<number, string>();

    constructor(private numChunks: number) { }

    addChunk(chunkNum: number, chunk: string) {
        this.received.set(chunkNum, chunk);
    }

    isComplete(): boolean {
        return this.received.size === this.numChunks;
    }

    getMessage(): string {
        if (this.numChunks === 1) return this.received.get(0);
        const ordered: string[] = [];
        for (let i = 0; i < this.numChunks; i++) {
            ordered.push(this.received.get(i));
        }
        return ordered.join('');
    }
}
