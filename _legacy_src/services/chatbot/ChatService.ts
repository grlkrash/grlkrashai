import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface ChatMessage {
    id: string;
    sender: string;
    content: string;
    timestamp: number;
    room?: string;
}

export class ChatService extends EventEmitter {
    private static instance: ChatService;
    private ws: WebSocket.Server;
    private clients: Map<string, WebSocket>;
    private rooms: Map<string, Set<string>>;

    private constructor() {
        super();
        this.clients = new Map();
        this.rooms = new Map();
        this.ws = new WebSocket.Server({ port: 8080 });
        this.setupWebSocket();
    }

    public static getInstance(): ChatService {
        if (!ChatService.instance) {
            ChatService.instance = new ChatService();
        }
        return ChatService.instance;
    }

    private setupWebSocket() {
        this.ws.on('connection', (socket: WebSocket) => {
            const clientId = Math.random().toString(36).substring(7);
            this.clients.set(clientId, socket);

            socket.on('message', (data: string) => {
                try {
                    const message: ChatMessage = JSON.parse(data);
                    this.handleMessage(clientId, message);
                } catch (error) {
                    console.error('Failed to parse message:', error);
                }
            });

            socket.on('close', () => {
                this.handleDisconnect(clientId);
            });
        });
    }

    private handleMessage(clientId: string, message: ChatMessage) {
        if (message.room) {
            // Room-specific message
            this.broadcastToRoom(message.room, message);
        } else {
            // Global message
            this.broadcast(message);
        }
    }

    private handleDisconnect(clientId: string) {
        // Remove client from all rooms
        this.rooms.forEach((clients, room) => {
            clients.delete(clientId);
            if (clients.size === 0) {
                this.rooms.delete(room);
            }
        });
        this.clients.delete(clientId);
    }

    public joinRoom(clientId: string, room: string) {
        if (!this.rooms.has(room)) {
            this.rooms.set(room, new Set());
        }
        this.rooms.get(room)?.add(clientId);
    }

    public leaveRoom(clientId: string, room: string) {
        const roomClients = this.rooms.get(room);
        if (roomClients) {
            roomClients.delete(clientId);
            if (roomClients.size === 0) {
                this.rooms.delete(room);
            }
        }
    }

    private broadcast(message: ChatMessage) {
        const messageStr = JSON.stringify(message);
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    }

    private broadcastToRoom(room: string, message: ChatMessage) {
        const messageStr = JSON.stringify(message);
        const roomClients = this.rooms.get(room);
        if (roomClients) {
            roomClients.forEach((clientId) => {
                const client = this.clients.get(clientId);
                if (client?.readyState === WebSocket.OPEN) {
                    client.send(messageStr);
                }
            });
        }
    }

    public sendMessage(sender: string, content: string, room?: string) {
        const message: ChatMessage = {
            id: Math.random().toString(36).substring(7),
            sender,
            content,
            timestamp: Date.now(),
            room
        };

        if (room) {
            this.broadcastToRoom(room, message);
        } else {
            this.broadcast(message);
        }
    }
} 