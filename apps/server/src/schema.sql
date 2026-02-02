users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
)

servers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
)

server_members (
  user_id INTEGER REFERENCES users(id),
  server_id INTEGER REFERENCES servers(id),
  PRIMARY KEY (user_id, server_id)
)

channels (
  id SERIAL PRIMARY KEY,
  server_id INTEGER REFERENCES servers(id),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('text', 'voice')),
  created_at TIMESTAMP DEFAULT now()
)

messages (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER REFERENCES channels(id),
  user_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
)
