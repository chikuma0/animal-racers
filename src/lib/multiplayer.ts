import { RealtimeChannel, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

import { ProtocolMessage } from './types';
import { supabase } from './supabase';

type MessageListener = (message: ProtocolMessage) => void;
type PresenceListener = (connectedIds: Set<string>) => void;

export class MultiplayerManager {
  private channel: RealtimeChannel | null = null;
  private roomCode = '';
  private readonly playerId: string;
  private messageListeners = new Set<MessageListener>();
  private presenceListeners = new Set<PresenceListener>();

  constructor() {
    this.playerId = this.generateId();
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  generateRoomCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  getPlayerId(): string {
    return this.playerId;
  }

  getRoomCode(): string {
    return this.roomCode;
  }

  async joinRoom(code: string): Promise<void> {
    this.roomCode = code;

    if (this.channel) {
      await supabase.removeChannel(this.channel);
    }

    const channel = supabase.channel(`room-${code}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: {
          key: this.playerId,
        },
      },
    });

    channel.on('broadcast', { event: 'protocol' }, payload => {
      const message = payload.payload as ProtocolMessage;
      if (message.senderId === this.playerId) return;
      if (message.recipientId && message.recipientId !== this.playerId) return;

      for (const listener of this.messageListeners) {
        listener(message);
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<Record<string, unknown>>();
      const connectedIds = new Set(Object.keys(state));
      for (const listener of this.presenceListeners) {
        listener(connectedIds);
      }
    });

    await new Promise<void>((resolve, reject) => {
      channel.subscribe(async (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({ playerId: this.playerId });
            resolve();
          } catch (trackError) {
            reject(trackError);
          }
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(err ?? new Error(`Failed to subscribe to room ${code}.`));
        }
      });
    });

    this.channel = channel;
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  onPresenceSync(listener: PresenceListener): () => void {
    this.presenceListeners.add(listener);
    return () => {
      this.presenceListeners.delete(listener);
    };
  }

  async send(message: ProtocolMessage): Promise<void> {
    if (!this.channel) return;
    await this.channel.send({
      type: 'broadcast',
      event: 'protocol',
      payload: message,
    });
  }

  async disconnect() {
    if (this.channel) {
      await this.channel.untrack();
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
