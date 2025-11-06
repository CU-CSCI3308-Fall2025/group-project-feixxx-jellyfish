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
  host: 'localhost',
  port: 5432,
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

app.get('/', (req, res) => {
  res.render('pages/index', { layout: 'main' });
});

app.get('/login', (req, res) => {
  res.render('pages/login', { layout: 'main' });
});

app.post('/login', async (req, res) => {

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
      res.redirect('/login');
    }
    catch(err) {
      console.log('Failed to register', err)
      res.redirect('/register');
    }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// *****************************************************
// Section 5 : Start Server
// *****************************************************
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));