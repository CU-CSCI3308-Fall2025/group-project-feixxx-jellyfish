const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');// for email verification 

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
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // set true if you're using port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});


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

// Server-side password rule (same as front-end)
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%]).{10,}$/;


// *****************************************************
// Section 4 : Routes
// *****************************************************

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

/*app.get('/', (req, res) => {

  res.sendFile(path.join(__dirname, 'views', 'pages', 'homepage.html'));
});
*/
app.get('/', (req, res) => {
  res.render('pages/home', {
    layout: 'main',
    title: 'Home | Verdant',
    isHomePage: true
  });
});

app.get('/login', (req, res) => {
  res.render('pages/login', { layout: 'main' });
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).render('pages/login', {
        layout: 'main',
        title: 'Plant Logger — Login',
        error: 'Please enter both email and password.',
        enteredEmail: email|| ''
      });
    }

    // 1) Look up user by email
    const user = await db.oneOrNone(
      'SELECT id, first_name, last_name, email, password FROM users WHERE email = $1',
      [email]
    );

    // 2) If user not found ⇒ suggest registration
    if (!user) {
      return res.status(404).render('pages/login', {
        layout: 'main',
        title: 'Plant Logger — Login',
        noUser: true,
        enteredEmail: email
      });
    }

    // 3) Compare provided password to stored hash (password column)
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).render('pages/login', {
        layout: 'main',
        title: 'Plant Logger — Login',
        error: 'Invalid password.',
        enteredEmail: email
      });
    }

    // 4) Successful login ⇒ set session + redirect
    req.session.user = { 
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    
    };
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
    const { first_name, last_name, email, password } = req.body;

    // basic validation
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).render('pages/register', {
        layout: 'main',
        title: 'Register',
        error: 'First name, last name, email, and password are required.',
        enteredFirstName: first_name || '',
        enteredLastName: last_name || '',
        enteredEmail: email || ''
      });
    

    }

    if (!passwordRegex.test(password)) {
      return res.status(400).render('pages/register', {
        layout: 'main',
        title: 'Register',
        error:
          'Password must be at least 10 characters and include 1 uppercase, 1 lowercase, 1 number, and 1 special character (!,@,#,$,%).',
        enteredFirstName: first_name,
        enteredLastName: last_name,
        enteredEmail: email
      });
    }

    // hash password
    const hash = await bcrypt.hash(password, 10);

     // insert and get new user id
    const row = await db.one(
      `INSERT INTO users (first_name, last_name, email, password)
       VALUES ($1, $2, $3, $4)
       RETURNING id, first_name, last_name, email`,
      [first_name, last_name, email, hash]
    );

    // create session and go to profile
    req.session.user = {
      id: row.id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name
    };
    return req.session.save(() => res.redirect('/profile'));

   } catch (err) {
    // handle duplicate email nicely (Postgres unique_violation)
    if (err && err.code === '23505') {
      return res.status(409).render('pages/register', {
        layout: 'main',
        title: 'Register',
        error: 'That email is already registered.',
        enteredFirstName: req.body.first_name,
        enteredLastName: req.body.last_name,
        enteredEmail: req.body.email
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
  const emailChange = req.session.emailChange || null;

  const viewData = {
    layout: 'main',
    title: 'Your Profile',
    // flags for template
    emailChangePending: !!emailChange,
    emailChangeTarget: emailChange ? emailChange.oldEmail : null,
    emailChangeNewEmail: emailChange ? emailChange.newEmail : null,
    emailChangeError: req.session.emailChangeError || null,
    emailChangeSuccess: req.session.emailChangeSuccess || null
  };

  // clear one-time messages
  req.session.emailChangeError = null;
  req.session.emailChangeSuccess = null;

  return res.status(200).render('pages/profile', viewData);
});

app.post('/profile/request-email-change', requireAuth, async (req, res) => {
  try {
    const { new_email } = req.body;
    const currentUser = req.session.user;

    if (!new_email) {
      req.session.emailChangeError = 'Please enter a new email address.';
      return res.redirect('/profile');
    }

    if (new_email === currentUser.email) {
      req.session.emailChangeError = 'New email cannot be the same as your current email.';
      return res.redirect('/profile');
    }

    // Make sure no one else is already using this email
    const existing = await db.oneOrNone(
      'SELECT id FROM users WHERE email = $1',
      [new_email]
    );
    if (existing) {
      req.session.emailChangeError = 'That email is already in use.';
      return res.redirect('/profile');
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in session for now (10 min expiry)
    req.session.emailChange = {
      code,
      newEmail: new_email,
      oldEmail: currentUser.email,
      expiresAt: Date.now() + 10 * 60 * 1000
    };

    // Send verification code to *current* email
    await mailer.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: currentUser.email,
      subject: 'Plant Logger: Email change verification code',
      text:
        `You requested to change your Plant Logger email.\n\n` +
        `Verification code: ${code}\n` +
        `This code expires in 10 minutes.\n\n` +
        `If you did not request this, you can ignore this email.`
    });

    req.session.emailChangeError = null;
    req.session.emailChangeSuccess = 'We sent a verification code to your current email.';
    return res.redirect('/profile');

  } catch (err) {
    console.error('Error requesting email change:', err);
    req.session.emailChangeError = 'Could not send verification email. Please try again.';
    return res.redirect('/profile');
  }
});

app.post('/profile/confirm-email-change', requireAuth, async (req, res) => {
  try {
    const { verification_code } = req.body;
    const currentUser = req.session.user;
    const info = req.session.emailChange;

    if (!info) {
      req.session.emailChangeError = 'No email change is pending.';
      return res.redirect('/profile');
    }

    if (!verification_code) {
      req.session.emailChangeError = 'Please enter the verification code.';
      return res.redirect('/profile');
    }

    if (Date.now() > info.expiresAt) {
      req.session.emailChange = null;
      req.session.emailChangeError = 'Verification code has expired. Please request a new one.';
      return res.redirect('/profile');
    }

    if (verification_code.trim() !== info.code) {
      req.session.emailChangeError = 'Invalid verification code.';
      return res.redirect('/profile');
    }

    const oldEmail = info.oldEmail;
    const newEmail = info.newEmail;

    // Double-check the new email isn't taken (race condition)
    const existing = await db.oneOrNone(
      'SELECT id FROM users WHERE email = $1 AND id <> $2',
      [newEmail, currentUser.id]
    );
    if (existing) {
      req.session.emailChangeError = 'That email is already in use.';
      return res.redirect('/profile');
    }

    // Update DB
    await db.none(
      'UPDATE users SET email = $1 WHERE id = $2',
      [newEmail, currentUser.id]
    );

    // Update session
    req.session.user.email = newEmail;

    // Clear pending info
    req.session.emailChange = null;

    // Notify old email that change happened
    try {
      await mailer.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: oldEmail,
        subject: 'Plant Logger: Email address changed',
        text:
          `Your Plant Logger account email has been changed from ${oldEmail} to ${newEmail}.\n\n` +
          `If you did not make this change, please contact support immediately.`
      });
    } catch (notifyErr) {
      console.error('Failed to send email change notification:', notifyErr);
      // but we don’t block the change for that
    }

    req.session.emailChangeSuccess = 'Your email address has been updated.';
    return res.redirect('/profile');

  } catch (err) {
    console.error('Error confirming email change:', err);
    req.session.emailChangeError = 'Could not confirm email change. Please try again.';
    return res.redirect('/profile');
  }
});





function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
app.post('/profile/cancel-email-change', requireAuth, (req, res) => {
  req.session.emailChange = null;
  req.session.emailChangeError = null;
  req.session.emailChangeSuccess = 'Email change request cancelled.';
  return res.redirect('/profile');
});





// *****************************************************
// Section 4.1 : Sample user credentials insertion
// *****************************************************
async function seedUsers() {
  const users = [
    {
      first_name: 'Alice',
      last_name: 'Example',
      email: 'alice@example.com',
      password: 'alicepassword'
    },
    {
      first_name: 'Bob',
      last_name: 'Example',
      email: 'bob@example.com',
      password: 'bobpassword'
    },
    {
      first_name: 'Charlie',
      last_name: 'Example',
      email: 'charlie@example.com',
      password: 'charliepassword'
    }
  ];


  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await db.none(
      `INSERT INTO users (first_name, last_name, email, password)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [u.first_name, u.last_name, u.email, hash]
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