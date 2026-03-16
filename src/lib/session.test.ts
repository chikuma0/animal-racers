import { describe, expect, it } from 'vitest';

import {
  applyCharacterPick,
  applyJoinRequest,
  applyRaceFinish,
  applyReadyState,
  buildFightResults,
  canStartRace,
  createRoomState,
  haveAllPlayersFinishedRace,
  shouldAcceptFightHit,
  syncConnectedPlayers,
} from './session';
import { createDefaultFightState } from './types';

describe('session authority helpers', () => {
  it('accepts one guest and rejects a third player once the room is full', () => {
    const room = createRoomState('1234', 'host', 'Host');
    const joined = applyJoinRequest(room, 'guest', 'Guest');
    const rejected = applyJoinRequest(joined.room, 'third', 'Third');

    expect(joined.accepted).toBe(true);
    expect(Object.keys(joined.room.players)).toHaveLength(2);
    expect(rejected.accepted).toBe(false);
    expect(rejected.reason).toBe('Room is full.');
  });

  it('releases a previous character claim when a player switches', () => {
    let room = createRoomState('1234', 'host', 'Host');
    room = applyJoinRequest(room, 'guest', 'Guest').room;

    room = applyCharacterPick(room, 'host', 'lion');
    room = applyCharacterPick(room, 'guest', 'lion');
    expect(room.players.guest.character).toBeNull();

    room = applyCharacterPick(room, 'host', 'wolf');
    room = applyCharacterPick(room, 'guest', 'lion');

    expect(room.players.host.character).toBe('wolf');
    expect(room.players.guest.character).toBe('lion');
  });

  it('requires both connected players to have characters and ready state before race start', () => {
    let room = createRoomState('1234', 'host', 'Host');
    room = applyJoinRequest(room, 'guest', 'Guest').room;
    room = applyCharacterPick(room, 'host', 'lion');
    room = applyCharacterPick(room, 'guest', 'wolf');

    expect(canStartRace(room)).toBe(false);

    room = applyReadyState(room, 'host', true);
    room = applyReadyState(room, 'guest', true);

    expect(canStartRace(room)).toBe(true);
  });

  it('sorts canonical race results by elapsed time and detects full completion', () => {
    let room = createRoomState('1234', 'host', 'Alex');
    room = applyJoinRequest(room, 'guest', 'Alex').room;
    room = applyCharacterPick(room, 'host', 'lion');
    room = applyCharacterPick(room, 'guest', 'wolf');
    room = applyReadyState(room, 'host', true);
    room = applyReadyState(room, 'guest', true);
    room.phase = 'racing';
    room.phaseSeq = 2;

    room = applyRaceFinish(room, 'guest', 4100);
    room = applyRaceFinish(room, 'host', 3950);

    expect(room.raceResults.map(result => result.playerId)).toEqual(['host', 'guest']);
    expect(room.raceResults.map(result => result.rank)).toEqual([1, 2]);
    expect(haveAllPlayersFinishedRace(room)).toBe(true);
  });

  it('resets the room back to waiting and clears ready state when a guest disconnects', () => {
    let room = createRoomState('1234', 'host', 'Host');
    room = applyJoinRequest(room, 'guest', 'Guest').room;
    room = applyCharacterPick(room, 'host', 'lion');
    room = applyCharacterPick(room, 'guest', 'wolf');
    room = applyReadyState(room, 'host', true);
    room = applyReadyState(room, 'guest', true);
    room.phase = 'racing';
    room.phaseSeq = 5;
    room.raceResults = [{ playerId: 'host', elapsedMs: 3000, rank: 1 }];

    const { room: nextRoom, removedPlayerIds } = syncConnectedPlayers(room, new Set(['host']));

    expect(removedPlayerIds).toEqual(['guest']);
    expect(nextRoom.phase).toBe('waiting');
    expect(nextRoom.raceResults).toEqual([]);
    expect(nextRoom.players.host.ready).toBe(false);
  });

  it('accepts only fresh fight-hit reports for the current battle phase', () => {
    const room = createRoomState('1234', 'host', 'Host');
    room.players.guest = {
      id: 'guest',
      name: 'Guest',
      connected: true,
      character: 'wolf',
      ready: true,
    };
    room.phase = 'battle';
    room.phaseSeq = 7;

    const report = {
      type: 'fight_hit_report' as const,
      senderId: 'guest',
      phaseSeq: 7,
      attackId: 'attack-1',
      attackerId: 'guest',
      attackerX: 150,
      targetId: 'host',
      attackType: 'punch' as const,
      damage: 12,
      freeze: false,
    };

    expect(shouldAcceptFightHit(room, report, new Set())).toBe(true);
    expect(shouldAcceptFightHit(room, report, new Set(['attack-1']))).toBe(false);
    expect(
      shouldAcceptFightHit(
        {
          ...room,
          phaseSeq: 8,
        },
        report,
        new Set()
      )
    ).toBe(false);
  });

  it('builds fight results by player id and chooses the highest hp fighter as winner', () => {
    let room = createRoomState('1234', 'host', 'Alex');
    room = applyJoinRequest(room, 'guest', 'Alex').room;
    room.players.host.character = 'lion';
    room.players.guest.character = 'wolf';

    const hostFight = createDefaultFightState();
    hostFight.hp = 34;
    const guestFight = createDefaultFightState();
    guestFight.hp = 12;

    const finalized = buildFightResults(room, {
      host: hostFight,
      guest: guestFight,
    });

    expect(finalized.fightWinnerId).toBe('host');
    expect(finalized.fightResults.map(result => result.playerId)).toEqual(['host', 'guest']);
    expect(finalized.fightResults.map(result => result.rank)).toEqual([1, 2]);
  });
});
