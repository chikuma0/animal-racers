import { supabase } from './supabase';
import { BroadcastPayload, PlayerState, CharacterId, GamePhase } from './types';
import { RealtimeChannel } from '@supabase/supabase-js';

export class MultiplayerManager {
  private channel: RealtimeChannel | null = null;
  private roomCode: string = '';
  private playerId: string;
  private listeners: Map<string, ((payload: BroadcastPayload) => void)[]> = new Map();

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

    // Clean up existing channel
    if (this.channel) {
      await supabase.removeChannel(this.channel);
    }

    this.channel = supabase.channel(`room-${code}`, {
      config: {
        broadcast: { self: false },
      },
    });

    this.channel.on('broadcast', { event: 'game' }, (payload) => {
      const data = payload.payload as BroadcastPayload;
      if (data.senderId === this.playerId) return;

      const typeListeners = this.listeners.get(data.type) || [];
      for (const listener of typeListeners) {
        listener(data);
      }

      // Also notify 'all' listeners
      const allListeners = this.listeners.get('all') || [];
      for (const listener of allListeners) {
        listener(data);
      }
    });

    await this.channel.subscribe();
  }

  broadcast(type: BroadcastPayload['type'], data: Record<string, unknown>) {
    if (!this.channel) return;

    this.channel.send({
      type: 'broadcast',
      event: 'game',
      payload: {
        type,
        senderId: this.playerId,
        data,
      } as BroadcastPayload,
    });
  }

  on(type: string, callback: (payload: BroadcastPayload) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  off(type: string) {
    this.listeners.delete(type);
  }

  async disconnect() {
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.listeners.clear();
  }

  // Broadcast player position (called frequently during race)
  broadcastPosition(player: PlayerState) {
    this.broadcast('player_update', {
      x: player.x,
      progress: player.progress,
      lap: player.lap,
      speed: player.speed,
      boosting: player.boosting,
      jumping: player.jumping,
      frozen: player.frozen,
      shielded: player.shielded,
      hitStun: player.hitStun,
      finished: player.finished,
      finishTime: player.finishTime,
      battleFinished: player.battleFinished,
      battleFinishTime: player.battleFinishTime,
      character: player.character,
      name: player.name,
    });
  }

  broadcastJoin(name: string) {
    this.broadcast('player_join', { name });
  }

  broadcastReady() {
    this.broadcast('player_ready', {});
  }

  broadcastCharacterPick(character: CharacterId) {
    this.broadcast('character_pick', { character });
  }

  broadcastStartGame() {
    this.broadcast('start_game', { startTime: Date.now() + 4000 });
  }

  broadcastPhaseChange(phase: GamePhase) {
    this.broadcast('phase_change', { phase });
  }

  broadcastAttack(character: CharacterId, targetId?: string) {
    this.broadcast('attack', { character, targetId });
  }

  broadcastLapComplete(lap: number) {
    this.broadcast('lap_complete', { lap });
  }

  broadcastRaceFinish(time: number) {
    this.broadcast('race_finish', { finishTime: time });
  }

  broadcastBattleFinish(time: number) {
    this.broadcast('battle_finish', { battleFinishTime: time });
  }
}
