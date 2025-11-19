-- Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL
);

INSERT INTO users (username, password) VALUES
('alice', 'alicepassword'),
('bob', 'bobpassword'),
('charlie', 'charliepassword');

-- Plants
CREATE TABLE IF NOT EXISTS plants (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    date_observed DATE NOT NULL,
    type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO plants (user_id, name, is_public, latitude, longitude, description, image_url, date_observed, type)
VALUES
(1, 'Bluebell', TRUE, 40.770, -105.420, 'Found near the riverbank.',
 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Hyacinthoides_non-scripta_%28Common_Bluebell%29.jpg/500px-Hyacinthoides_non-scripta_%28Common_Bluebell%29.jpg',
 CURRENT_DATE, 'flower'),
(1, 'Wild Rose', FALSE, 40.775, -105.410, 'Backyard discovery!',
 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Rosa_acicularis_8448.JPG/500px-Rosa_acicularis_8448.JPG',
 CURRENT_DATE, 'flower'),
(2, 'Clover', TRUE, 40.772, -105.425, 'Found during a hike.',
 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Clovers_%26_Zrebar.jpg/500px-Clovers_%26_Zrebar.jpg',
 CURRENT_DATE, 'flower');

-- Users_Plants junction table
CREATE TABLE IF NOT EXISTS users_plants (
    user_id INT NOT NULL,
    plant_id INT NOT NULL,
    PRIMARY KEY (user_id, plant_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (plant_id) REFERENCES plants(id)
);
