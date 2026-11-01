import type { SQLiteDatabase } from 'expo-sqlite';
import {
  countryRepository,
  gameRepository,
  tournamentRepository,
  userRepository,
} from '../database/repositories';
import { hashPassword } from '../auth/passwordHash';

/**
 * Utility function to clean up test users from the database
 * This is useful for development and testing purposes
 */
export async function cleanupTestUsers(db: SQLiteDatabase): Promise<{ deleted: number; users: any[] }> {
  try {
    // Get all users
    const users = await userRepository.list(db);
    
    let deletedCount = 0;
    const deletedUsers: any[] = [];
    
    // Delete all users (be careful with this in production!)
    for (const user of users) {
      await userRepository.delete(db, user.id);
      deletedCount++;
      deletedUsers.push({
        id: user.id,
        username: user.username,
        email: user.email,
      });
    }
    
    console.log(`Deleted ${deletedCount} test users:`);
    deletedUsers.forEach(user => {
      console.log(`  - ${user.username} (${user.email})`);
    });
    
    return { deleted: deletedCount, users: deletedUsers };
  } catch (error) {
    console.error('Error cleaning up test users:', error);
    throw error;
  }
}

/**
 * Delete a specific user by login (username or email)
 */
export async function deleteUserByLogin(db: SQLiteDatabase, login: string): Promise<boolean> {
  try {
    const user = await userRepository.getByLogin(db, login);
    if (user) {
      await userRepository.delete(db, user.id);
      console.log(`Deleted user: ${user.username} (${user.email})`);
      return true;
    }
    console.log(`User not found: ${login}`);
    return false;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/**
 * List all users in the database
 */
export async function listAllUsers(db: SQLiteDatabase): Promise<{ users: any[]; message: string }> {
  try {
    const users = await userRepository.list(db);
    console.log(`Total users in database: ${users.length}`);
    users.forEach(user => {
      console.log(`  - ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Verified: ${user.is_verified ? 'Yes' : 'No'}`);
    });
    
    if (users.length === 0) {
      return { users, message: 'No users in database' };
    }
    
    const userDetails = users.map(user => 
      `• ${user.username} (${user.email}) - ${user.is_verified ? 'Verified' : 'Not verified'}`
    ).join('\n');
    
    return { users, message: `Total users: ${users.length}\n\n${userDetails}` };
  } catch (error) {
    console.error('Error listing users:', error);
    throw error;
  }
}

/**
 * Create a test user automatically for development
 */
export async function createTestUser(db: SQLiteDatabase, email: string): Promise<{ user: any; password: string }> {
  try {
    const testUsername = 'testuser';
    const testPassword = 'TestPass12';
    const passwordHash = await hashPassword(testPassword);
    
    // Check if user already exists by username or email
    const existingUserByUsername = await userRepository.getByLogin(db, testUsername);
    const existingUserByEmail = await userRepository.getByLogin(db, email);
    
    // Delete existing users if they exist
    if (existingUserByUsername) {
      console.log('Test user with same username already exists, deleting...');
      await userRepository.delete(db, existingUserByUsername.id);
    }
    
    if (existingUserByEmail && existingUserByEmail.id !== existingUserByUsername?.id) {
      console.log('User with same email already exists, deleting...');
      await userRepository.delete(db, existingUserByEmail.id);
    }
    
    // Create new user
    const userId = await userRepository.create(db, {
      username: testUsername,
      email: email,
      password_hash: passwordHash,
      role: 'user',
      terms_accepted: true,
    });
    
    await userRepository.setVerified(db, userId);

    const user = await userRepository.getById(db, userId);
    if (!user) {
      throw new Error('Failed to retrieve created user');
    }
    
    console.log(`Test user created successfully:`);
    console.log(`  - Username: ${user.username}`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - Password: ${testPassword}`);
    console.log(`  - Verified: ${user.is_verified ? 'Yes' : 'No'}`);
    
    return { user, password: testPassword };
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  }
}

const DEMO_GAMES: { name: string; category: string }[] = [
  { name: 'Valorant', category: 'FPS' },
  { name: 'Chess', category: 'Board' },
  { name: 'Street Fighter 6', category: 'Fighting' },
  { name: 'Rocket League', category: 'Sports' },
];

const DEMO_COUNTRIES: { name: string; code: string; region: string }[] = [
  { name: 'United States', code: 'US', region: 'Americas' },
  { name: 'Colombia', code: 'CO', region: 'Americas' },
  { name: 'Japan', code: 'JP', region: 'Asia' },
];

async function ensureDemoCatalog(db: SQLiteDatabase) {
  const games = await gameRepository.list(db);
  const countries = await countryRepository.list(db);

  for (const game of DEMO_GAMES) {
    if (!games.some((existing) => existing.name.toLowerCase() === game.name.toLowerCase())) {
      await gameRepository.create(db, game.name, game.category);
    }
  }
  for (const country of DEMO_COUNTRIES) {
    if (!countries.some((existing) => existing.code === country.code)) {
      await countryRepository.create(db, country);
    }
  }

  return { games: await gameRepository.list(db), countries: await countryRepository.list(db) };
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Seeds a small, varied set of games, countries and tournaments owned by the
 * given organizer, and registers the given player for one of them. Useful
 * for exercising search, filters, segments and the detail screen with real
 * data instead of only empty states.
 */
export async function seedDemoTournaments(
  db: SQLiteDatabase,
  organizerId: number,
  playerId: number,
): Promise<{ created: number }> {
  const { games, countries } = await ensureDemoCatalog(db);
  const findGame = (name: string) => games.find((game) => game.name === name)!.id;
  const findCountry = (code: string) => countries.find((country) => country.code === code)!.id;

  const tournaments = [
    {
      name: 'Winter Valorant Clash',
      description: 'A fast-paced weekend cup for local Valorant squads.',
      game_id: findGame('Valorant'),
      country_id: findCountry('US'),
      organizer_id: organizerId,
      timezone: 'UTC',
      start_at: daysFromNow(3),
      scope: 'local' as const,
      visibility: 'public' as const,
      format: 'single_elimination',
      capacity: 16,
      status: 'published' as const,
    },
    {
      name: 'National Chess Open',
      description: 'The biggest open chess tournament of the season.',
      game_id: findGame('Chess'),
      country_id: findCountry('CO'),
      organizer_id: organizerId,
      timezone: 'UTC',
      start_at: daysFromNow(10),
      scope: 'national' as const,
      visibility: 'public' as const,
      format: 'round_robin',
      capacity: 32,
      status: 'published' as const,
    },
    {
      name: 'World SF6 Championship',
      description: 'Top fighters from around the globe compete for the title.',
      game_id: findGame('Street Fighter 6'),
      country_id: findCountry('JP'),
      organizer_id: organizerId,
      timezone: 'UTC',
      start_at: daysFromNow(-1),
      scope: 'international' as const,
      visibility: 'public' as const,
      format: 'double_elimination',
      capacity: 64,
      status: 'ongoing' as const,
    },
    {
      name: 'Draft Rocket League Cup',
      description: 'Still being planned; only visible to its organizer.',
      game_id: findGame('Rocket League'),
      country_id: findCountry('US'),
      organizer_id: organizerId,
      timezone: 'UTC',
      start_at: daysFromNow(20),
      scope: 'regional' as const,
      visibility: 'public' as const,
      format: 'single_elimination',
      capacity: 8,
      status: 'draft' as const,
    },
    {
      name: 'Spring Local Clash',
      description: 'A completed local tournament, kept for history.',
      game_id: findGame('Valorant'),
      country_id: findCountry('US'),
      organizer_id: organizerId,
      timezone: 'UTC',
      start_at: daysFromNow(-10),
      scope: 'local' as const,
      visibility: 'public' as const,
      format: 'single_elimination',
      capacity: 16,
      status: 'completed' as const,
    },
  ];

  let followedTournamentId: number | null = null;
  for (const tournament of tournaments) {
    const id = await tournamentRepository.create(db, tournament);
    if (tournament.name === 'Winter Valorant Clash') followedTournamentId = id;
  }

  if (followedTournamentId) {
    await db.runAsync(
      'INSERT OR IGNORE INTO registrations (tournament_id, player_id, status) VALUES (?, ?, ?)',
      followedTournamentId,
      playerId,
      'registered',
    );
  }

  console.log(`Seeded ${tournaments.length} demo tournaments for organizer ${organizerId}.`);
  return { created: tournaments.length };
}

/** Removes every tournament, leaving users, games and countries untouched. */
export async function clearAllTournaments(db: SQLiteDatabase): Promise<{ deleted: number }> {
  const all = await tournamentRepository.list(db);
  for (const tournament of all) {
    await tournamentRepository.delete(db, tournament.id);
  }
  console.log(`Deleted ${all.length} tournaments.`);
  return { deleted: all.length };
}