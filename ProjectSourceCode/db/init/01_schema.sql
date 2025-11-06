CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- seed demo: username = leaflover, password = test123
INSERT INTO users (username, password_hash)
VALUES (
  'leaflover',
  '$2b$10$8b7GQm1Lw4F8lCwz9W3l6O1R1eFvJk1l8mR2Qd3C7zS8x8m1O5m6K'
)
ON CONFLICT (username) DO NOTHING;
