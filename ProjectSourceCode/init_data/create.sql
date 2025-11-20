CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(200) NOT NULL
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
    user_id INT NOT NULL references users(id),
    plant_id INT NOT NULL references plants(plant_id),
    PRIMARY KEY (user_id, plant_id)
);

--ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS plant_logs (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  plant_id INT NOT NULL REFERENCES plants(plant_id) ,

  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  photo_url TEXT
);

