CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS plants(
    plant_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sci_name VARCHAR(100),
    plant_type VARCHAR(50),
    season VARCHAR (50),
    plant_description TEXT,
    Latitude DOUBLE PRECISION,
    Longitude DOUBLE PRECISION,
    img_url TEXT
);

CREATE TABLE IF NOT EXISTS users_plants(
    username foreign key references users(username),
    plant_id foreign key references plants(id)
);

INSERT INTO users (username, password) VALUES
('alice', 'alicepassword'),
('bob', 'bobpassword'),
('charlie', 'charliepassword');