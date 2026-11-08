import type { SQLiteDatabase } from 'expo-sqlite';
import {
  countryRepository,
  gameRepository,
  matchRepository,
  notificationRepository,
  playerRepository,
  rankingRepository,
  registrationRepository,
  reportRepository,
  stageRepository,
  tournamentRepository,
  userRepository,
} from './repositories';
import type { TournamentScope } from '../types/tournament';

const GHOST_USERS = [
  { username: 'nova_striker', display: 'Nova Striker', game: 'Valorant' },
  { username: 'pixel_wraith', display: 'Pixel Wraith', game: 'League of Legends' },
  { username: 'checkmate_lux', display: 'Checkmate Lux', game: 'Chess' },
  { username: 'turbo_breach', display: 'Turbo Breach', game: 'Rocket League' },
  { username: 'golden_boot', display: 'Golden Boot', game: 'EA Sports FC 25' },
  { username: 'headshot_ivy', display: 'Headshot Ivy', game: 'Counter-Strike 2' },
  { username: 'rune_warden', display: 'Rune Warden', game: 'Dota 2' },
  { username: 'storm_glider', display: 'Storm Glider', game: 'Fortnite' },
  { username: 'apex_shade', display: 'Apex Shade', game: 'Apex Legends' },
  { username: 'nano_blade', display: 'Nano Blade', game: 'Overwatch 2' },
  { username: 'smash_talon', display: 'Smash Talon', game: 'Super Smash Bros. Ultimate' },
  { username: 'iron_fist_rey', display: 'Iron Fist Rey', game: 'Street Fighter 6' },
  { username: 'mishima_prime', display: 'Mishima Prime', game: 'Tekken 8' },
  { username: 'ghost_recon', display: 'Ghost Recon', game: 'Call of Duty: Warzone' },
  { username: 'siege_owl', display: 'Siege Owl', game: 'Rainbow Six Siege' },
  { username: 'zerg_hunter', display: 'Zerg Hunter', game: 'StarCraft II' },
  { username: 'card_shark', display: 'Card Shark', game: 'Hearthstone' },
  { username: 'mana_binder', display: 'Mana Binder', game: 'Magic: The Gathering Arena' },
  { username: 'unite_fable', display: 'Unite Fable', game: 'Pokemon Unite' },
  { username: 'brawl_pixie', display: 'Brawl Pixie', game: 'Brawl Stars' },
];

const DEMO_COUNTRIES: { name: string; code: string; region: string }[] = [
  { name: 'Colombia', code: 'CO', region: 'Americas' },
  { name: 'United States', code: 'US', region: 'Americas' },
  { name: 'Mexico', code: 'MX', region: 'Americas' },
  { name: 'Brazil', code: 'BR', region: 'Americas' },
  { name: 'Spain', code: 'ES', region: 'Europe' },
  { name: 'Germany', code: 'DE', region: 'Europe' },
  { name: 'South Korea', code: 'KR', region: 'Asia' },
  { name: 'Japan', code: 'JP', region: 'Asia' },
];

const SCOPES: TournamentScope[] = ['national', 'international'];
const FORMATS = ['single_elimination', 'double_elimination', 'round_robin'];

function iso(daysFromNow: number, hour = 18): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function fixedIso(day: number, hour = 18): string {
  return new Date(Date.UTC(2026, 10, day, hour, 0, 0, 0)).toISOString();
}

// Varied November 2026 windows for the 8 ongoing demo tournaments.
const ONGOING_WINDOWS: { startDay: number; endDay: number }[] = [
  { startDay: 15, endDay: 18 },
  { startDay: 16, endDay: 19 },
  { startDay: 17, endDay: 21 },
  { startDay: 15, endDay: 20 },
  { startDay: 18, endDay: 22 },
  { startDay: 16, endDay: 23 },
  { startDay: 19, endDay: 24 },
  { startDay: 15, endDay: 24 },
];

// Varied capacities (12-20) for the 8 ongoing demo tournaments, each fully booked.
const ONGOING_CAPACITIES = [18, 16, 14, 20, 13, 18, 15, 17];

/**
 * Demo content for first-run installations: on a completely empty database it
 * creates 20 ghost users, one tournament per user (each on a different game),
 * cross-registrations so every user participates in at least 3 tournaments
 * (one tournament is filled to capacity), 8 tournaments ongoing and the rest
 * published open for sign-ups, plus 8 invite-only private tournaments hosted
 * by the first four ghost organizers. Runs exactly once — afterwards users
 * exist and the guard skips it.
 */
export async function runDemoSeedIfEmpty(db: SQLiteDatabase): Promise<boolean> {
  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM users');
  if ((existing?.count ?? 0) > 0) return false;

  // --- Catalog -------------------------------------------------------------
  const existingGames = new Map((await gameRepository.listAll(db)).map((game) => [game.name, game.id]));
  const gameIds: number[] = [];
  for (const ghost of GHOST_USERS) {
    const id = existingGames.get(ghost.game) ?? (await gameRepository.create(db, ghost.game, 'Demo'));
    gameIds.push(id);
  }

  const existingCountries = new Map((await countryRepository.list(db)).map((country) => [country.code, country.id]));
  const countryIds: number[] = [];
  for (const country of DEMO_COUNTRIES) {
    const id = existingCountries.get(country.code) ?? (await countryRepository.create(db, country));
    countryIds.push(id);
  }

  // --- Users & players -------------------------------------------------------
  const userIds: number[] = [];
  const playerIds: number[] = [];
  for (let i = 0; i < GHOST_USERS.length; i++) {
    const ghost = GHOST_USERS[i];
    const userId = await userRepository.create(db, {
      username: ghost.username,
      email: `${ghost.username}@tierx.demo`,
      password_hash: 'demo-ghost-account',
      terms_accepted: true,
      role: 'organizer',
    });
    const player = await playerRepository.getOrCreateByUserId(db, userId, ghost.display);
    await playerRepository.update(db, player.id, {
      country_id: countryIds[i % countryIds.length],
      favorite_game_id: gameIds[i],
      bio: `Demo competitor — mainly plays ${ghost.game}.`,
    });
    userIds.push(userId);
    playerIds.push(player.id);
  }

  // --- Tournaments: one per user, each on a different game --------------------
  // Indices 0-7 are ongoing, the rest are published and open for registration.
  const tournamentIds: number[] = [];
  for (let i = 0; i < GHOST_USERS.length; i++) {
    const ghost = GHOST_USERS[i];
    const isOngoing = i < 8;
    // Ongoing tournaments get 12-20 slots (filled below); #10 is the "full" open one.
    const capacity = isOngoing ? ONGOING_CAPACITIES[i] : i === 10 ? 8 : 16 + (i % 3) * 8;
    const tournamentId = await tournamentRepository.create(db, {
      name: `${ghost.display}'s ${ghost.game} Open`,
      description: `Community ${ghost.game} tournament hosted by ${ghost.display}. Open brackets, fair play and bragging rights — join and climb the local ranking.`,
      game_id: gameIds[i],
      country_id: countryIds[i % countryIds.length],
      organizer_id: userIds[i],
      timezone: 'UTC',
      start_at: isOngoing ? fixedIso(ONGOING_WINDOWS[i].startDay, 16 + i) : iso(10 + (i % 5) * 4),
      end_at: isOngoing ? fixedIso(ONGOING_WINDOWS[i].endDay, 20) : iso(11 + (i % 5) * 4),
      registration_opens_at: isOngoing ? fixedIso(ONGOING_WINDOWS[i].startDay - 20) : iso(-7),
      registration_closes_at: isOngoing ? fixedIso(ONGOING_WINDOWS[i].startDay - 1, 23) : iso(5 + (i % 5) * 3),
      visibility: 'public',
      scope: SCOPES[i % SCOPES.length],
      format: FORMATS[i % FORMATS.length],
      capacity,
      rules: '1. Respect all participants. 2. Show up 15 minutes before your match. 3. The organizer\'s ruling is final.',
      prizes: 'Top 3 earn a spot in the season finals.',
      status: isOngoing ? 'ongoing' : 'published',
    });
    tournamentIds.push(tournamentId);
  }

  // --- Registrations: every user participates in at least 3 other tournaments -
  const registrationsPerUser = new Map<number, number>();
  for (let i = 0; i < GHOST_USERS.length; i++) {
    const offsets = [3, 7, 12]; // deterministic spread so every user lands on 3 different tournaments
    for (const offset of offsets) {
      const target = (i + offset) % GHOST_USERS.length;
      if (target === i || target === 0) continue; // tournament 0 keeps only its 2 finalists
      await registrationRepository.registerUnchecked(db, tournamentIds[target], playerIds[i]);
      registrationsPerUser.set(i, (registrationsPerUser.get(i) ?? 0) + 1);
    }
    // A couple of extra joins so the cross-participation feels organic.
    const extra = (i + 9) % GHOST_USERS.length;
    if (extra !== i && (i % 2 === 0)) {
      await registrationRepository.registerUnchecked(db, tournamentIds[extra], playerIds[i]);
      registrationsPerUser.set(i, (registrationsPerUser.get(i) ?? 0) + 1);
    }
  }

  // --- Fill tournament #10 to capacity ---------------------------------------
  const fullIndex = 10;
  const fullCapacity = 8;
  let filled = 0;
  for (let i = 0; i < GHOST_USERS.length && filled < fullCapacity; i++) {
    if (i === fullIndex) continue;
    await registrationRepository.registerUnchecked(db, tournamentIds[fullIndex], playerIds[i]);
    filled++;
  }
  // Two extra players land on the waitlist so the "full" state is visible.
  for (let i = 0; i < 2; i++) {
    const playerIndex = (fullIndex + 5 + i) % GHOST_USERS.length;
    if (playerIndex === fullIndex) continue;
    await db.runAsync(
      `INSERT INTO registrations (tournament_id, player_id, status, registered_at)
       VALUES (?, ?, 'waitlisted', CURRENT_TIMESTAMP)
       ON CONFLICT(tournament_id, player_id) DO UPDATE SET status = 'waitlisted'`,
      tournamentIds[fullIndex],
      playerIds[playerIndex],
    );
  }

  // --- Fill every ongoing tournament to capacity ------------------------------
  for (let i = 0; i < 8; i++) {
    for (const playerId of playerIds) {
      if ((await registrationRepository.countActive(db, tournamentIds[i])) >= ONGOING_CAPACITIES[i]) break;
      await registrationRepository.registerUnchecked(db, tournamentIds[i], playerId);
    }
  }

  // --- Bracket activity inside the 8 ongoing tournaments ----------------------
  for (let i = 0; i < 8; i++) {
    const tournamentId = tournamentIds[i];
    const participants = await registrationRepository.listParticipants(db, tournamentId);
    if (participants.length < 2) continue;

    // Tournament 0 (Nova Striker's, 18 entrants) is deep into its bracket:
    // 16 players were eliminated across play-in, R16, quarters and semis —
    // only the 2 finalists remain, playing the ongoing final match.
    if (i === 0) {
      const stageId = await stageRepository.create(db, {
        tournament_id: tournamentId,
        name: 'Playoffs',
        position: 1,
        format: 'single_elimination',
      });
      const ids = participants.map((p) => p.player_id);
      const playCompletedMatch = async (round: number, num: number, one: number, two: number, day: number, hour: number) => {
        const id = await matchRepository.create(db, {
          stage_id: stageId,
          round_number: round,
          match_number: num,
          player_one_id: one,
          player_two_id: two,
          scheduled_at: fixedIso(day, hour),
        });
        await matchRepository.markOngoing(db, id);
        await matchRepository.recordResult(db, id, { score_one: 3, score_two: 1, winner_id: one, evidence_uri: null });
        await rankingRepository.recordMatchOutcome(db, gameIds[i], one, two);
      };

      // Play-in: 18 -> 16
      await playCompletedMatch(1, 1, ids[0], ids[1], ONGOING_WINDOWS[0].startDay, 16);
      await playCompletedMatch(1, 2, ids[2], ids[3], ONGOING_WINDOWS[0].startDay, 17);
      // Round of 16 -> 8 (play-in winners ids[0]/ids[2] plus 14 more)
      const r16 = [ids[0], ids[2], ...ids.slice(4, 18)];
      for (let m = 0; m < 8; m++) {
        await playCompletedMatch(2, m + 1, r16[m * 2], r16[m * 2 + 1], ONGOING_WINDOWS[0].startDay + 1, 15 + m);
      }
      // Quarterfinals -> 4
      const quarter = [ids[0], ids[2], ids[6], ids[8], ids[10], ids[12], ids[14], ids[16]];
      for (let m = 0; m < 4; m++) {
        await playCompletedMatch(3, m + 1, quarter[m * 2], quarter[m * 2 + 1], ONGOING_WINDOWS[0].startDay + 1, 20 + m);
      }
      // Semifinals -> 2 finalists
      await playCompletedMatch(4, 1, ids[0], ids[2], ONGOING_WINDOWS[0].endDay - 1, 18);
      await playCompletedMatch(4, 2, ids[10], ids[12], ONGOING_WINDOWS[0].endDay - 1, 19);

      // The final itself — still being played between the last 2 players.
      const finalMatchId = await matchRepository.create(db, {
        stage_id: stageId,
        round_number: 5,
        match_number: 1,
        player_one_id: ids[0],
        player_two_id: ids[10],
        scheduled_at: fixedIso(ONGOING_WINDOWS[0].endDay - 1, 20),
      });
      await matchRepository.markOngoing(db, finalMatchId);
      continue;
    }

    const stageId = await stageRepository.create(db, {
      tournament_id: tournamentId,
      name: 'Playoffs',
      position: 1,
      format: 'single_elimination',
    });

    // A completed match so rankings and match history already have content.
    const doneMatchId = await matchRepository.create(db, {
      stage_id: stageId,
      round_number: 1,
      match_number: 1,
      player_one_id: participants[0].player_id,
      player_two_id: participants[1].player_id,
      scheduled_at: fixedIso(ONGOING_WINDOWS[i].startDay, 19),
    });
    await matchRepository.markOngoing(db, doneMatchId);
    const [winner, loser] = participants[0].player_id < participants[1].player_id ? [participants[0], participants[1]] : [participants[1], participants[0]];
    await matchRepository.recordResult(db, doneMatchId, {
      score_one: winner === participants[0] ? 3 : 1,
      score_two: winner === participants[0] ? 1 : 3,
      winner_id: winner.player_id,
      evidence_uri: null,
    });
    await rankingRepository.recordMatchOutcome(db, gameIds[i], winner.player_id, loser.player_id);

    // And an upcoming scheduled match.
    if (participants.length >= 4) {
      await matchRepository.create(db, {
        stage_id: stageId,
        round_number: 1,
        match_number: 2,
        player_one_id: participants[2].player_id,
        player_two_id: participants[3].player_id,
        scheduled_at: fixedIso(ONGOING_WINDOWS[i].endDay - 1, 20),
      });
    }
  }

  // --- A few notifications & reports so those feeds are not empty -------------
  await notificationRepository.create(db, {
    user_id: userIds[0],
    type: 'registration',
    title: 'New registration',
    message: `${GHOST_USERS[3].display} registered for "${GHOST_USERS[0].display}'s ${GHOST_USERS[0].game} Open".`,
  });
  await notificationRepository.create(db, {
    user_id: userIds[1],
    type: 'result',
    title: 'Result published',
    message: 'Your quarterfinal match result was published.',
  });
  await reportRepository.create(db, {
    reporter_id: userIds[7],
    tournament_id: tournamentIds[10],
    reason: 'Tournament is already full — organizer should raise capacity.',
  });

  await seedPrivateDemoTournaments(db);

  return true;
}

/**
 * Private, invite-only demo tournaments: the first four ghost organizers each
 * host two private tournaments on games different from their main one, each
 * with its own registration window and start/end dates. Idempotent — skips
 * any tournament whose name already exists for that organizer, so it can also
 * run on top of an already-seeded database.
 */
const PRIVATE_DEMO_TOURNAMENTS: {
  organizer: string;
  tournaments: { name: string; description: string; game: string; code: string }[];
}[] = [
  {
    organizer: 'nova_striker',
    tournaments: [
      {
        name: 'Summoners Invite: LoL Clash',
        description: 'Invite-only League of Legends scrim series hosted by Nova Striker. Hand-picked rosters, drafted captains and a single-elimination bracket to crown the invite champions.',
        game: 'League of Legends',
        code: '11223344',
      },
      {
        name: 'Closed Blitz Chess Arena',
        description: 'A private rapid-chess arena for Nova Striker\'s inner circle. Ten-minute games, strict fair-play checks and a round-robin table so everyone faces everyone.',
        game: 'Chess',
        code: '22334455',
      },
    ],
  },
  {
    organizer: 'pixel_wraith',
    tournaments: [
      {
        name: 'Wraith Valorant Inhouse',
        description: 'Private in-house Valorant league run by Pixel Wraith. Invite only — balanced squads, custom map pool and no streamed matches until playoffs.',
        game: 'Valorant',
        code: '33445566',
      },
      {
        name: 'Underground RL Soccar Cup',
        description: 'A closed Rocket League soccar cup for Pixel Wraith\'s crew. 3v3 private lobbies, best-of-five series and bragging rights on the line.',
        game: 'Rocket League',
        code: '44556677',
      },
    ],
  },
  {
    organizer: 'checkmate_lux',
    tournaments: [
      {
        name: 'Lux FC Pro Clubs Night',
        description: 'Invite-only EA Sports FC 25 pro clubs night hosted by Checkmate Lux. Private sessions, fixed positions and a knockout tree decided over one evening.',
        game: 'EA Sports FC 25',
        code: '55667788',
      },
      {
        name: 'Closed CS2 Aim Duels',
        description: 'A private Counter-Strike 2 aim-duel bracket organized by Checkmate Lux. Mirror matchups on aim maps only — no entry without an invite.',
        game: 'Counter-Strike 2',
        code: '66778899',
      },
    ],
  },
  {
    organizer: 'turbo_breach',
    tournaments: [
      {
        name: 'Breach Dota Inhouse League',
        description: 'Turbo Breach\'s private Dota 2 in-house league. Captains draft from a closed player pool and every series is played in private lobbies.',
        game: 'Dota 2',
        code: '77889900',
      },
      {
        name: 'Private Fortnite Customs',
        description: 'Closed Fortnite custom lobbies hosted by Turbo Breach. Invite-only squads, scrim ruleset and placement points across three private matches.',
        game: 'Fortnite',
        code: '88990011',
      },
    ],
  },
];

export async function seedPrivateDemoTournaments(db: SQLiteDatabase): Promise<number> {
  const games = new Map((await gameRepository.listAll(db)).map((game) => [game.name, game.id]));
  const countries = await countryRepository.list(db);
  if (countries.length === 0) return 0;

  let created = 0;
  let index = 0;
  for (const entry of PRIVATE_DEMO_TOURNAMENTS) {
    const organizer = await userRepository.getByLogin(db, entry.organizer);
    if (!organizer) continue;

    for (const tournament of entry.tournaments) {
      const gameId = games.get(tournament.game);
      if (!gameId) continue;

      const existing = await db.getFirstAsync<{ id: number; access_code: string | null }>(
        'SELECT id, access_code FROM tournaments WHERE name = ? AND organizer_id = ?',
        tournament.name,
        organizer.id,
      );
      if (existing) {
        // Backfill the access code on databases seeded before codes existed.
        if (!existing.access_code) {
          await db.runAsync('UPDATE tournaments SET access_code = ? WHERE id = ?', tournament.code, existing.id);
        }
        continue;
      }

      await tournamentRepository.create(db, {
        name: tournament.name,
        description: tournament.description,
        game_id: gameId,
        country_id: countries[index % countries.length].id,
        organizer_id: organizer.id,
        timezone: 'UTC',
        start_at: iso(7 + index * 2),
        end_at: iso(8 + index * 2),
        registration_opens_at: iso(-5 + index),
        registration_closes_at: iso(4 + index),
        visibility: 'private',
        access_code: tournament.code,
        scope: SCOPES[index % SCOPES.length],
        format: FORMATS[index % FORMATS.length],
        capacity: 8 + (index % 3) * 4,
        rules: '1. Invite only — no public sign-ups. 2. Show up 15 minutes before your match. 3. The organizer\'s ruling is final.',
        prizes: 'Invite-only prize pool shared among the top finishers.',
        status: 'published',
      });
      index++;
      created++;
    }
  }
  return created;
}
