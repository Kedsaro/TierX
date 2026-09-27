export const DATABASE_NAME = 'tierx.db';
export const DATABASE_VERSION = 3;

export const migrations: Record<number, string> = {
  1: `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(username)) > 0),
      email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(email)) > 0),
      password_hash TEXT NOT NULL CHECK (length(password_hash) > 0),
      is_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'organizer', 'admin')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) > 0),
      category TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
    );

    CREATE TABLE countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) > 0),
      code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(code) = 2),
      region TEXT
    );

    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
      country_id INTEGER REFERENCES countries(id) ON DELETE SET NULL,
      favorite_game_id INTEGER REFERENCES games(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      description TEXT,
      image_uri TEXT,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
      country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
      organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      timezone TEXT NOT NULL DEFAULT 'UTC' CHECK (length(trim(timezone)) > 0),
      start_at TEXT NOT NULL,
      end_at TEXT,
      registration_opens_at TEXT,
      registration_closes_at TEXT,
      visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
      scope TEXT NOT NULL DEFAULT 'local' CHECK (scope IN ('local', 'regional', 'national', 'international')),
      format TEXT NOT NULL DEFAULT 'single_elimination' CHECK (length(trim(format)) > 0),
      capacity INTEGER NOT NULL CHECK (capacity > 0),
      rules TEXT,
      requirements TEXT,
      prizes TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'ongoing', 'completed', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (end_at IS NULL OR end_at >= start_at),
      CHECK (registration_closes_at IS NULL OR registration_opens_at IS NULL OR registration_closes_at >= registration_opens_at)
    );

    CREATE TABLE rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL DEFAULT 1000 CHECK (rating >= 0),
      wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
      losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (player_id, game_id)
    );
  `,
  2: `
    CREATE TABLE registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('pending', 'registered', 'waitlisted', 'cancelled', 'rejected')),
      registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tournament_id, player_id)
    );

    CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      starts_at TEXT NOT NULL,
      ends_at TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (ends_at IS NULL OR ends_at >= starts_at)
    );

    CREATE TABLE stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      position INTEGER NOT NULL CHECK (position > 0),
      format TEXT NOT NULL,
      UNIQUE (tournament_id, position)
    );

    CREATE TABLE matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stage_id INTEGER NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL CHECK (round_number > 0),
      match_number INTEGER NOT NULL CHECK (match_number > 0),
      player_one_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      player_two_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      winner_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      scheduled_at TEXT,
      score_one INTEGER CHECK (score_one IS NULL OR score_one >= 0),
      score_two INTEGER CHECK (score_two IS NULL OR score_two >= 0),
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'disputed', 'completed', 'cancelled')),
      evidence_uri TEXT,
      UNIQUE (stage_id, round_number, match_number),
      CHECK (player_one_id IS NULL OR player_two_id IS NULL OR player_one_id <> player_two_id)
    );

    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE user_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'private')),
      notifications_enabled INTEGER NOT NULL DEFAULT 1 CHECK (notifications_enabled IN (0, 1)),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      tournament_id INTEGER REFERENCES tournaments(id) ON DELETE SET NULL,
      target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
      details TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT
    );

    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_registrations_player_status ON registrations(player_id, status);
    CREATE INDEX idx_registrations_tournament_status ON registrations(tournament_id, status);
    CREATE INDEX idx_events_tournament_status_start ON events(tournament_id, status, starts_at);
    CREATE INDEX idx_stages_tournament_position ON stages(tournament_id, position);
    CREATE INDEX idx_matches_stage_status_schedule ON matches(stage_id, status, scheduled_at);
    CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
    CREATE INDEX idx_reports_status_created ON reports(status, created_at DESC);
    CREATE INDEX idx_audit_logs_entity_created ON audit_logs(entity_type, entity_id, created_at DESC);
  `,
  3: `
    ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
  `,
};

export const indexes = `
  CREATE INDEX IF NOT EXISTS idx_tournaments_name ON tournaments(name COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS idx_tournaments_game_start ON tournaments(game_id, start_at);
  CREATE INDEX IF NOT EXISTS idx_tournaments_country_start ON tournaments(country_id, start_at);
  CREATE INDEX IF NOT EXISTS idx_tournaments_organizer_status ON tournaments(organizer_id, status);
  CREATE INDEX IF NOT EXISTS idx_tournaments_status_visibility_start ON tournaments(status, visibility, start_at);
  CREATE INDEX IF NOT EXISTS idx_players_display_name ON players(display_name COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS idx_rankings_game_rating ON rankings(game_id, rating DESC);
`;