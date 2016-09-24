import SocketIO = require('socket.io');
import express = require('express');
import http = require('http');
import os = require('os');
import basicAuth = require('basic-auth');

import {
    getSignalerPort,
    getSignalerHost,
    PeersRequest,
    PeersUpdate,
    ConnectionRequest,
    ConnectionResponse
} from './Protocol';

import { STATUS_USERNAME, STATUS_PASSWORD } from './Auth';

class Signaler {
    private app = express();
    private server: http.Server;
    private io: SocketIO.Server;

    private port: number;
    private host: string;

    private useDebug = false;
    private useLog = true;

    private numSockets = 0;
    private numPadsMemo: number = null; // memoized

    start(port: number, host: string) {
        this.port = port;
        this.host = host;

        this.server = this.app.listen(port, host, () => {
            console.log(`Signaler listening on ${host}:${port}`); // tslint:disable-line
        });

        this.app.set('json spaces', 2);
        this.app.use('/bpstatus', auth(STATUS_USERNAME, STATUS_PASSWORD));
        this.app.get('/bpstatus', (req: express.Request, res: express.Response) => res.json(this.getStatus()));

        this.io = SocketIO(this.server);
        this.io.of('/bp').on('connection', socket => {
            this.log(socket, 'connected');
            this.numSockets++;

            socket.on(PeersRequest.messageType, (data: PeersRequest) => {
                this.log(socket, PeersRequest.messageType, data);
                this.broadcastToPad(socket, data.padId, PeersRequest.messageType, data);
            });

            socket.on(PeersUpdate.messageType, (data: PeersUpdate) => {
                this.log(socket, PeersUpdate.messageType, data);
                this.broadcastToPad(socket, data.padId, PeersUpdate.messageType, data);
            });

            socket.on(ConnectionRequest.messageType, (data: ConnectionRequest) => {
                this.log(socket, ConnectionRequest.messageType, data);
                this.broadcastToPad(socket, data.padId, ConnectionRequest.messageType, data);
            });

            socket.on(ConnectionResponse.messageType, (data: ConnectionResponse) => {
                this.log(socket, ConnectionResponse.messageType, data);
                this.broadcastToPad(socket, data.padId, ConnectionResponse.messageType, data);
            });

            socket.on('disconnect', () => {
                this.log(socket, ' disconnected');
                this.numSockets--;
            });
        });

    }

    private broadcastToPad(socket: SocketIO.Socket, padId: string, msgType: string, data: any) {
        if (!padId) {
            this.log(socket, 'Invalid padId: ', padId);
        }
        const roomId = padId.substr(0, 50); // don't let clients take up arbitrary amounts of persistent server memory
        socket.join(roomId); // use this opportunity to ensure this client is in the channel
        this.numPadsMemo = null; // blow away memoized stat (could have made a new room)

        // IDEA: maybe just forward to one (or a few) than everyone in the pad (if we know we can)
        socket.broadcast.to(roomId).emit(msgType, data);
        this.debug(socket, msgType, ' forwarded');
    }

    private getStatus() {
        const load = os.loadavg()[0];
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();

        if (this.numPadsMemo === null) {
            let numPads = 0;
            const rooms = this.io.sockets.adapter.rooms;
            for (const roomId in rooms) {
                if (rooms.hasOwnProperty(roomId)) numPads++;
            }
            this.numPadsMemo = numPads;
        }

        return {
            app: {
                numClients: this.numSockets,
                numPads: this.numPadsMemo
            },
            sys: {
                load: load,
                totalMemory: totalMemory,
                totalMemoryMB: asMB(totalMemory),
                freeMemory: freeMemory,
                freeMemoryMB: asMB(freeMemory),
                usedMemory: totalMemory - freeMemory,
                usedMemoryMB: asMB(totalMemory - freeMemory)
            }
        };
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

}

function asMB(bytes: number) {
    if (bytes === null) return 'null';
    if (bytes === undefined) return 'undefined';
    return (bytes / (1024 * 1024)).toFixed(2) + 'MB';
}

function auth(username: string, password: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = basicAuth(req);
    if (!user || user.name !== username || user.pass !== password) {
      res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
      return res.sendStatus(401);
    }
    next();
  };
};

if (require.main === module) {
    const port = getSignalerPort();
    const host = getSignalerHost();
    console.log(`Attempting to start bp-signaler on "${host}" port ${port}`); // tslint:disable-line
    new Signaler().start(port, host);
}
