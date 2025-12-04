const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');// for email verification 
const { createGzip } = require('zlib');

require('dotenv').config();



// Serve static files
app.use('/assets', express.static(path.join(__dirname,'views', 'pages', 'assets')));
app.use(express.static(path.join(__dirname, 'public')));


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
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

console.log("🔥 DEBUG SMTP CONFIG FROM RENDER:", {
  HOST: process.env.SMTP_HOST,
  PORT: process.env.SMTP_PORT,
  USER: process.env.SMTP_USER,
  PASS_LENGTH: process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0,
});



// Add these functions
async function clearDatabaseData() {
  try {
    // Clear data but keep tables
    await db.none('DELETE FROM plant_logs');
    await db.none('DELETE FROM users_plants');
    await db.none('DELETE FROM plants');
    await db.none('DELETE FROM users');
    
    // Reset sequences
    await db.none('ALTER SEQUENCE users_id_seq RESTART WITH 1');
    await db.none('ALTER SEQUENCE plants_plant_id_seq RESTART WITH 1');
    await db.none('ALTER SEQUENCE plant_logs_id_seq RESTART WITH 1');
    
    console.log('✅ Database data cleared');
    return true;
  } catch (err) {
    console.error('❌ Database clear error:', err);
    return false;
  }
}


const createTables = async () => {
    try {
        // Users table
        await db.none(`
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                profile_pic_url TEXT
            )
        `);

        // Plants table - ALTER if is_public doesn't exist
        await db.none(`
            CREATE TABLE IF NOT EXISTS plants (
                plant_id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                sci_name VARCHAR(100),
                plant_type VARCHAR(50),
                season VARCHAR(50),
                is_public BOOLEAN DEFAULT TRUE,
                date_observed DATE,
                plant_description TEXT,
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                photo_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL
            )
        `);

        // Check and add is_public column if it doesn't exist
        await db.none(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='plants' AND column_name='is_public') THEN
                    ALTER TABLE plants ADD COLUMN is_public BOOLEAN DEFAULT TRUE;
                END IF;
            END $$;
        `);

        // Users_Plants junction table
        await db.none(`
            CREATE TABLE IF NOT EXISTS users_plants (
                user_plant_id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                plant_id INTEGER NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
                is_favorite BOOLEAN DEFAULT FALSE,
                custom_name VARCHAR(100),
                custom_notes TEXT,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, plant_id)
            )
        `);

        // Plant logs table
        await db.none(`
            CREATE TABLE IF NOT EXISTS plant_logs (
                log_id SERIAL PRIMARY KEY,
                plant_id INTEGER NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                log_date DATE DEFAULT CURRENT_DATE,
                log_type VARCHAR(50),
                log_description TEXT,
                health_status VARCHAR(50),
                photo_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for better performance
        await db.none('CREATE INDEX IF NOT EXISTS idx_plants_is_public ON plants(is_public)');
        await db.none('CREATE INDEX IF NOT EXISTS idx_plants_name_lower ON plants(LOWER(name))');
        await db.none('CREATE INDEX IF NOT EXISTS idx_users_plants_user_id ON users_plants(user_id)');
        await db.none('CREATE INDEX IF NOT EXISTS idx_plant_logs_plant_id ON plant_logs(plant_id)');
        await db.none('CREATE INDEX IF NOT EXISTS idx_plant_logs_user_id ON plant_logs(user_id)');

        console.log('All tables created or verified successfully');
        
    } catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    }
};

// Run the function
createTables();


async function initializeDatabase() {
  try {
    // Always clear data on startup
    await clearDatabaseData();
    
    // Seed data
    await seedUsers();
    await seedPlants();
    
    console.log('✅ Database initialized with fresh data');
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  }
}

// Update your connection
db.connect()
  .then(obj => {
    console.log('✅ Database connection successful');
    obj.done();
    return initializeDatabase();
  })
  .catch(error => {
    console.log('❌ Database connection error:', error.message || error);
  });



// Configure Handlebars with helpers
const hbs = handlebars.create({
  extname: 'hbs',
  helpers: {
    // Format date
    formatDate: function(date) {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    },
    // Check if user is logged in
    ifUser: function(user, options) {
      if (user) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    }
  }
});

app.engine('hbs', hbs.engine);

// *****************************************************
// Section 3 : App Settings
// *****************************************************
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
app.get('/logPlants', requireAuth, async (req, res) => {
  try {
    // Optional: fetch existing plants for a dropdown
    const plants = await db.any(`SELECT plant_id, name FROM plants ORDER BY name`);

    res.render('pages/logPlants', {
      layout: 'main',
      title: 'Log a New Plant',
      plants
    });
  } catch (err) {
    console.error('Cannot load plant logging page', err);
    res.status(500).send('Server error');
  }
});



app.post('/logPlants', requireAuth, async (req, res) => {
  try {
    const { name, sci_name, plant_type, season, plant_description, Latitude, Longitude, photo_url, is_public } = req.body;
    const publicFlag = is_public === "on";

    if (!name || name.trim() === '') {
      return res.status(400).render('pages/logPlants', {
        layout: 'main',
        error: 'Plant name is required',
        enteredName: name,
        enteredSciName: sci_name,
        enteredPhotoUrl: photo_url
      });
    }

   //Check if plant already exists
    let plant = await db.oneOrNone(
      'SELECT plant_id FROM plants WHERE name = $1',
      [name.trim()]
    );

  
    if (!plant) {
      plant = await db.one(
        `INSERT INTO plants (name, sci_name, plant_type, season, plant_description, Latitude, Longitude, photo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING plant_id`,
        [
          name.trim(),
          sci_name || null,
          plant_type || null,
          season || null,
          plant_description || null,
          Latitude || null,
          Longitude || null,
          photo_url || null
        ]
      );
    }

    await db.none(
      `INSERT INTO plant_logs (user_id, plant_id, photo_url, is_public)
       VALUES ($1, $2, $3, $4)`,
      [req.session.user.id, plant.plant_id, photo_url || null, publicFlag]
    );

  
    await db.none(
      `INSERT INTO users_plants (user_id, plant_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.session.user.id, plant.plant_id]
    );

    res.redirect('/activity');
  } catch (err) {
    console.error('Error logging plant:', err);
    res.status(500).render('pages/logPlants', {
      layout: 'main',
      error: 'Something went wrong. Please try again.'
    });
  }
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
         pl.photo_url
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



// Individual plant view
app.get('/plants/:id', async (req, res) => {
  try {
    const plantId = req.params.id;
    
    // Get the plant details
    const plant = await db.oneOrNone(
      `SELECT * FROM plants WHERE plant_id = $1`,
      [plantId]
    );
    
    if (!plant) {
      return res.status(404).render('pages/plantView', {
        layout: 'main',
        title: 'Plant Not Found',
        plant: null
      });
    }
    
    // Get related plants (same type or season)
    const relatedPlants = await db.any(
      `SELECT plant_id, name, photo_url, plant_type, season 
       FROM plants 
       WHERE (plant_type = $1 OR season = $2) 
         AND plant_id != $3 
         AND is_public = TRUE
       LIMIT 4`,
      [plant.plant_type, plant.season, plantId]
    );
    
    res.render('pages/plantView', {
      layout: 'main',
      title: `${plant.name} | Plant Details`,
      plant: {
        ...plant,
        bloom_season: plant.season // Add bloom_season for consistency
      },
      relatedPlants
    });
    
  } catch (err) {
    console.error('Plant view error:', err);
    res.status(500).render('pages/plantView', {
      layout: 'main',
      title: 'Error',
      plant: null,
      error: 'Could not load plant details.'
    });
  }
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
    // await is allowed inside an async function
    console.log(`Seeding user: ${u.first_name}`);
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

 
app.get('/api/plants', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.session.user.id;

    // Fetch current user's plant logs
    const myPlants = await db.any(`
      SELECT p.plant_id AS id,
             p.name,
             p.plant_type AS type,
             p.plant_description AS description,
             pl.photo_url,
             pl.is_public,
             p."latitude",
             p."longitude" 
      FROM plant_logs pl
      JOIN plants p ON pl.plant_id = p.plant_id
      WHERE pl.user_id = $1
        AND p."latitude" IS NOT NULL
        AND p."longitude" IS NOT NULL
    `, [currentUserId]);

    // Fetch other users' public plant logs
    const publicPlants = await db.any(`
      SELECT p.plant_id AS id,
             p.name,
             p.plant_type AS type,
             p.plant_description AS description,
             pl.photo_url,
             pl.is_public,
             p."latitude",
             p."longitude"
      FROM plant_logs pl
      JOIN plants p ON pl.plant_id = p.plant_id
      WHERE pl.is_public = TRUE 
        AND pl.user_id != $1
        AND p."latitude" IS NOT NULL
        AND p."longitude" IS NOT NULL
    `, [currentUserId]);

    return res.json({
      currentUserId,
      myPlants,
      publicPlants
    });

  } catch (err) {
    console.error('Error fetching plants', err);
    res.status(500).json({ error: "Server error" });
  }
});


async function seedPlants() {
  const plants = [
    {
      name: 'California Poppy',
      sci_name: 'Eschscholzia californica',
      plant_type: 'Flower',
      season: 'Spring',
      is_public: true,
      date_observed: '2024-03-15',
      plant_description: 'Bright orange native wildflower commonly found in open fields.',
      latitude: 34.0522,
      longitude: -118.2437,
      photo_url: '/assets/sample_pics/poppy.jpg'
    },
    {
      name: 'Coast Live Oak',
      sci_name: 'Quercus agrifolia',
      plant_type: 'Tree',
      season: 'Year-round',
      is_public: true,
      date_observed: '2024-04-02',
      plant_description: 'Large evergreen oak tree native to coastal California.',
      latitude: 36.7783,
      longitude: -119.4179,
      photo_url: '/assets/sample_pics/oak.jpg'
    },
    {
      name: 'Toyon',
      sci_name: 'Heteromeles arbutifolia',
      plant_type: 'Shrub',
      season: 'Winter',
      is_public: true,
      date_observed: '2024-12-10',
      plant_description: 'Shrub with red berries, also known as Christmas berry or Hollywood plant.',
      latitude: 34.1,
      longitude: -118.35,
      photo_url: 'https://www.gardenia.net/wp-content/uploads/2023/05/heteromeles-arbutifolia.webp'
    }
  ];

  for (const p of plants) {
    console.log(`Seeding plant: ${p.name}`);

    await db.none(
      `INSERT INTO plants 
       (name, sci_name, plant_type, season, is_public, date_observed,
        plant_description, latitude, longitude, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT DO NOTHING`,
      [
        p.name,
        p.sci_name,
        p.plant_type,
        p.season,
        p.is_public,
        p.date_observed,
        p.plant_description,
        p.latitude,
        p.longitude,
        p.photo_url
      ]
    );
  }

  console.log('Sample plants seeded');
}


//searchbar functionality

app.get('/search', async (req, res) => {
  try {
    const { q, season } = req.query;
    
    // Base SQL and params
    let sql = `SELECT * FROM plants WHERE is_public = TRUE`;
    const params = [];
    let paramCount = 0;

    // Text search - fixed logic
    if (q && q.trim() !== '') {
      paramCount++;
      params.push(`%${q.trim().toLowerCase()}%`);
      sql += ` AND LOWER(name) LIKE $${paramCount}`;
    }

    // Season filter - use 'season' not 'category'
    if (season && season !== 'All') {
      let startMonth, endMonth;
      switch (season.toLowerCase()) {
        case 'spring': startMonth = 3; endMonth = 5; break;
        case 'summer': startMonth = 6; endMonth = 8; break;
        case 'fall':   startMonth = 9; endMonth = 11; break;
        case 'winter': startMonth = 12; endMonth = 2; break;
        default: startMonth = endMonth = null;
      }

      if (startMonth && endMonth) {
        if (startMonth < endMonth) {
          paramCount++;
          params.push(startMonth);
          paramCount++;
          params.push(endMonth);
          sql += ` AND EXTRACT(MONTH FROM date_observed)
                   BETWEEN $${paramCount - 1} AND $${paramCount}`;
        } else {
          // Winter wrap case (Dec-Feb)
          paramCount++;
          params.push(startMonth);
          paramCount++;
          params.push(endMonth);
          sql += ` AND (
                    EXTRACT(MONTH FROM date_observed) >= $${paramCount - 1}
                 OR EXTRACT(MONTH FROM date_observed) <= $${paramCount}
                 )`;
        }
      }
    }

    console.log('Search SQL:', sql);
    console.log('Search params:', params);
    
    const results = await db.any(sql, params);
    
    // Transform results to match template expectations if needed
    const transformedResults = results.map(plant => ({
      ...plant,
      bloom_season: plant.season // Map 'season' to 'bloom_season' for template
    }));

    res.render('pages/searchResults', {
      title: "Search Results",
      layout: "main",
      results: transformedResults,
      query: q || '',
      season: season || 'all'
    });

  } catch (err) {
    console.error("Search error:", err.message, err);
    res.status(500).render('pages/searchResults', {
      title: "Search Results",
      layout: "main",
      results: [],
      query: req.query.q || "",
      season: req.query.season || "all",
      error: "Something went wrong. Please try again."
    });
  }
});



// *****************************************************
// Section 5 : Start Server
// *****************************************************
const PORT = process.env.PORT || 3000;
//app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app.listen(PORT);
