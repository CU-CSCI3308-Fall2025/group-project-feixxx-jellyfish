const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
require('dotenv').config();

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

app.use(express.static(path.join(__dirname, 'public')));

// *****************************************************
// Section 4 : Routes
// *****************************************************

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

app.get('/', (req, res) => {
  res.render('pages/index', { layout: 'main' });
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

    // 1) Look up user
    const user = await db.oneOrNone(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    // 2) If no such username ⇒ show Register button
    if (!user) {
      return res.status(404).render('pages/login', {
        layout: 'main',
        title: 'Plant Logger — Login',
        noUser: true,                 // flag used by template to show the button
        enteredUsername: username     // prefill field
      });
    }

    // 3) If exists ⇒ compare password
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).render('pages/login', {
        layout: 'main',
        title: 'Plant Logger — Login',
        error: 'Invalid password.',
        enteredUsername: username
      });
    }

    // 4) Success ⇒ set session + redirect to home
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
    const { username, password }= req.body;
    
    try {
      const hash = await bcrypt.hash(req.body.password, 10);
      
      const query =`
      INSERT INTO users (username, password)
      VALUES ($1, $2)`;
  
      await db.none(query, [username, hash]);
  
      console.log('Succesful', username);
      res.status(200).json({message:'Success'});
    }
    catch(err) {
      console.log('Failed to register', err);
      res.status(400).json({message:'User already exists'});
    }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/map', (req, res) => {
  res.render('pages/map', {layout: 'main', isMapPage: true});
});

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