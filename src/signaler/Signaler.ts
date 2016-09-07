import http = require('http');
import SocketIO = require('socket.io');

import {
    getSignalerPort,
    getSignalerHost,
    PeersRequest,
    PeersUpdate,
    ConnectionRequest,
    ConnectionResponse
} from './Protocol';

class Signaler {

    private server: http.Server;
    private io: SocketIO.Server;

    private useDebug = true;
    private useLog = true;

    constructor() {
        this.server = http.createServer();
        this.io = SocketIO(this.server);

        // TODO: get the ids to match up on the clients so that
        // 1. we can ignore messages where they don't
        // 2. we can forward connection requests / responses only to people they're intended for if we have them

        this.io.on('connection', socket => {
            this.log(socket, 'connected');

            socket.on(PeersRequest.messageType, (data: PeersRequest) => {
                this.log(socket, PeersRequest.messageType, data);
                if (!this.ensurePad(socket, data.padId)) return;

                // IDEA: maybe just forward to one (or a few) than everyone
                socket.broadcast.to(data.padId).emit(PeersRequest.messageType, data);
                this.debug(socket, PeersRequest.messageType, ' forwarded');
            });

            socket.on(PeersUpdate.messageType, (data: PeersUpdate) => {
                this.log(socket, PeersUpdate.messageType, data);
                if (!this.ensurePad(socket, data.padId)) return;

                socket.broadcast.to(data.padId).emit(PeersUpdate.messageType, data);
                this.debug(socket, PeersUpdate.messageType, ' forwarded');
            });

            socket.on(ConnectionRequest.messageType, (data: ConnectionRequest) => {
                this.log(socket, ConnectionRequest.messageType, data);
                if (!this.ensurePad(socket, data.padId)) return;

                socket.broadcast.to(data.padId).emit(ConnectionRequest.messageType, data);
                this.debug(socket, ConnectionRequest.messageType, ' forwarded');
            });

            socket.on(ConnectionResponse.messageType, (data: ConnectionResponse) => {
                this.log(socket, ConnectionResponse.messageType, data);
                if (!this.ensurePad(socket, data.padId)) return;

                socket.broadcast.to(data.padId).emit(ConnectionResponse.messageType, data);
                this.debug(socket, ConnectionResponse.messageType, ' forwarded');
            });

            socket.on('disconnect', () => {
                this.log(socket, ' disconnected');
            });
        });
    }

    start(port: number = getSignalerPort(), host: string = getSignalerHost()) {
        this.server.listen(port, host);
        console.log(`Signaler listening on ${host}:${port}`); // tslint:disable-line
    }

    private debug(socket: SocketIO.Socket, ...msg: any[]) {
        this.log(socket, 'sent DEBUG: ', ...msg);
        if (!this.useDebug) {
            return;
        }
        socket.emit('DEBUG', msg ? msg.join('') : '');
    }

    private log(socket: SocketIO.Socket, ...msg: any[]) {
        if (!this.useLog) return;
        console.log(socket.id, ...msg); // tslint:disable-line
    }

    private isValidPad(padId: string): boolean {
        return !!padId;
    }

    private ensurePad(socket: SocketIO.Socket, padId: string): boolean {
        if (!this.isValidPad(padId)) {
            this.debug(socket, ' invalid pad!');
            return false;
        }
        // use this opportunity to ensure this client is in the channel
        socket.join(padId);
        return true;
    }

}

if (require.main === module) {
    new Signaler().start();
}
