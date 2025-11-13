const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
require('dotenv').config();



// Serve static files
app.use('/assets', express.static(path.join(__dirname,'views', 'pages', 'assets')));



// *****************************************************
// Section 2 : Connect to DB
// *****************************************************
const dbConfig = {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

const db = pgp(dbConfig);

db.connect()
  .then(obj => {
    console.log('✅ Database connection successful');
    obj.done();
  })
  .catch(error => {
    console.log('❌ Database connection error:', error.message || error);
  });

// *****************************************************
// Section 3 : App Settings
// *****************************************************
app.engine('hbs', handlebars.engine({ extname: 'hbs' }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'defaultsecret',
    saveUninitialized: false,
    resave: false,
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});



// *****************************************************
// Section 4 : Routes
// *****************************************************

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

app.get('/', (req, res) => {

  res.sendFile(path.join(__dirname, 'views', 'pages', 'homepage.html'));
});

app.get('/login', (req, res) => {
  res.render('pages/login', { layout: 'main' });
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).render('pages/login', {
        layout: 'main',
        title: 'Plant Logger — Login',
        error: 'Please enter both username and password.'
      });
    }

    // 1) Look up user by username
    const user = await db.oneOrNone(
      'SELECT id, username, password FROM users WHERE username = $1',
      [username]
    );

    // 2) If user not found ⇒ suggest registration
    if (!user) {
      return res.status(404).render('pages/login', {
        layout: 'main',
        title: 'Plant Logger — Login',
        noUser: true,
        enteredUsername: username
      });
    }

    // 3) Compare provided password to stored hash (password column)
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).render('pages/login', {
        layout: 'main',
        title: 'Plant Logger — Login',
        error: 'Invalid password.',
        enteredUsername: username
      });
    }

    // 4) Successful login ⇒ set session + redirect
    req.session.user = { id: user.id, username: user.username };
    req.session.save(() => res.redirect('/'));

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).render('pages/login', {
      layout: 'main',
      title: 'Plant Logger — Login',
      error: 'Login failed. Please try again.'
    });
  }
});

app.get('/register', (req, res) => {
  res.render('pages/register', { layout: 'main' });
});

app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // basic validation
    if (!username || !password) {
      return res.status(400).render('pages/register', {
        layout: 'main',
        title: 'Register',
        error: 'Username and password are required.',
        enteredUsername: username || ''
      });
    }

    // hash password
    const hash = await bcrypt.hash(password, 10);

    // insert and get new user id
    const row = await db.one(
      `INSERT INTO users (username, password)
       VALUES ($1, $2)
       RETURNING id, username`,
      [username, hash]
    );

    // create session and go to profile
    req.session.user = { id: row.id, username: row.username };
    return req.session.save(() => res.redirect('/profile'));

  } catch (err) {
    // handle duplicate username nicely (Postgres unique_violation)
    if (err && err.code === '23505') {
      return res.status(409).render('pages/register', {
        layout: 'main',
        title: 'Register',
        error: 'That username is already taken.',
        enteredUsername: req.body.username
      });
    }

    console.error('Failed to register', err);
    return res.status(500).render('pages/register', {
      layout: 'main',
      title: 'Register',
      error: 'Registration failed. Please try again.'
    });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/map', (req, res) => {
  res.render('pages/map', {layout: 'main', isMapPage: true});
});

// POST /log-plant
app.post('/log-plant', requireAuth, async (req, res) => {
  const { plant_id, photo_url } = req.body;
  if (!plant_id) return res.status(400).send('plant_id is required');

  await db.none(
    `INSERT INTO plant_logs (user_id, plant_id, photo_url)
     VALUES ($1, $2, $3)`,
    [req.session.user.id, plant_id, photo_url || null]
  );

  // optional: also save as favorite
  await db.none(
    `INSERT INTO users_plants (user_id, plant_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.session.user.id, plant_id]
  );

  res.redirect('/activity');
});

// GET /activity  — show last 5 logs (newest first). Empty list is OK.
app.get('/activity', requireAuth, async (req, res) => {
  try {
    const logs = await db.any(
      `SELECT
         pl.logged_at,
         to_char(pl.logged_at AT TIME ZONE 'America/Denver', 'YYYY-MM-DD HH24:MI') AS logged_at_str,
         p.plant_id,
         p.name AS plant_name,
         COALESCE(pl.photo_url, p.img_url) AS photo_url
       FROM plant_logs pl
       JOIN plants p ON p.plant_id = pl.plant_id
       WHERE pl.user_id = $1
       ORDER BY pl.logged_at DESC
       LIMIT 5`,
      [req.session.user.id]
    );

    // db.any returns [] when no rows — perfect for your {{#if logs.length}} check
    return res.status(200).render('pages/activity', {
      layout: 'main',
      title: 'Recent Activity',
      logs
    });
  } catch (err) {
    console.error('Activity load error:', err);
    // Show a friendly page even if the query fails
    return res.status(500).render('pages/activity', {
      layout: 'main',
      title: 'Recent Activity',
      logs: [],
      error: 'Could not load activity right now.'
    });
  }
});

// GET /profile — just render, protected
app.get('/profile', requireAuth, (req, res) => {
  return res.status(200).render('pages/profile', {
    layout: 'main',
    title: 'Your Profile'
  });
});


app.get('/profile', requireAuth, (req, res) => {
  res.render('pages/profile', {
    layout: 'main',
    title: 'Your Profile',
  });
});


function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}




// *****************************************************
// Section 4.1 : Sample user credentials insertion
// *****************************************************
async function seedUsers() {
  const users = [
    { username: 'alice', password: 'alicepassword' },
    { username: 'bob', password: 'bobpassword' },
    { username: 'charlie', password: 'charliepassword' }
  ];

  for (const u of users) {
    // await is allowed inside an async function
    const hash = await bcrypt.hash(u.password, 10);
    await db.none(
      'INSERT INTO users (username, password) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
      [u.username, hash]
    );
  }

  console.log('Sample users seeded');
}

// call once (after db connects)
seedUsers().catch(err => console.error('Seed error:', err));






app.get('/api/plants', async(req, res) => {
  try {
    if (!req.session.user){
      return res.status(401).json({error: 'Not logged it'});
    }

    const currentUserID = req.session.user.id;

    const myPlants = await db.any(
      'SELECT id, user_id, name, is_public, latitude, longitude, description, image_url, date_observed, type FROM plants WHERE user_id = $1',
      [currentUserId]
    );

    res.json({
      currentUserId,
      myPlants,
      publicPlants
    });
  } catch (err) {
    console.error('Error fetching plants', err);
    res.status(500).json({error: "Server error"});
  }
});

// *****************************************************
// Section 5 : Start Server
// *****************************************************
const PORT = process.env.PORT || 3000;
//app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app.listen(PORT);