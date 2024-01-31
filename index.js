const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');
const bcrypt = require('bcrypt');
const session = require('express-session');
const uuid = require('uuid');
const cors = require('cors');


const app = express();
const port = 3000;

// Middleware to parse JSON requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors());


app.use(session({
    secret: 'your-secret-key', // Replace with a strong and secure secret key
    resave: false,
    saveUninitialized: true
}));



// Serve static files (HTML in this case)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'css')));

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'html/index.html'));
});

//treeningud
app.get('/treeningud', async (req, res) => {
    res.sendFile(path.join(__dirname, 'html/treeningud.html'));
});

//foorum
app.get('/foorum', async (req, res) => {
    res.sendFile(path.join(__dirname, 'html/foorum.html'));
});

//artiklid
app.get('/artiklid', async (req, res) => {
    res.sendFile(path.join(__dirname, 'html/artiklid.html'));
});

//uudised
app.get('/uudised', async (req, res) => {
    res.sendFile(path.join(__dirname, 'html/uudised.html'));
});

// sisene
app.get('/sisene', async (req, res) => {
    res.sendFile(path.join(__dirname, 'html/sisene.html'));
});

app.get('/register', async (req, res) => {
    res.sendFile(path.join(__dirname, 'html/register.html'));
});
app.get('/test', (req, res) => {
    // Log the session information
    console.log('User session in test route:', req.session.user);

    // Send the session information in the response
    res.json({ session: req.session });
});

// Handle the sign-up form submission
app.post('/signup', async (req, res) => {
    const {username, phonenumber, email, password} = req.body;

    try {
        // Check if username or email already exists
        const checkQuery = 'SELECT * FROM kasutajad WHERE kasutajanimi = ? OR email = ?';
        db.query(checkQuery, [username, email], async (checkErr, checkResults) => {
            if (checkErr) {
                console.error('Error checking existing username or email:', checkErr);
                res.status(500).json({success: false, message: 'Serveripoolne viga!'});
            } else {
                if (checkResults.length > 0) {
                    // Username or email already exists
                    res.status(400).json({success: false, message: 'Kasutajanimi või email on juba kasutusel!'});
                } else {
                    // Check if the email has the required format
                    const emailRegex = /^[\w-]+(\.[\w-]+)*@voco\.ee$/;

                    if (!emailRegex.test(email)) {
                        // Invalid email format
                        res.status(400).json({
                            success: false,
                            message: 'E-mail peab olema ühendatud VOCO organisatsiooniga!'
                        });
                    } else {
                        // Hash the password
                        const hashedPassword = await bcrypt.hash(password, 10);

                        // Insert user data into the database
                        const insertQuery = 'INSERT INTO kasutajad (kasutajanimi, telefon, email, parool) VALUES (?, ?, ?, ?)';
                        db.query(insertQuery, [username, phonenumber, email, hashedPassword], (err, results) => {
                            if (err) {
                                console.error('Error inserting user into database:', err);
                                res.status(500).json({success: false, message: 'Serveripoolne viga!'});
                            } else {
                                console.log('User signed up successfully');
                                res.json({success: true, message: 'Kasuaja loomine õnnestus!'});
                            }
                        });
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error hashing password:', error);
        res.status(500).json({success: false, message: 'Serveripoolne viga!'});
    }
});




const sessions = []; // Object to store active sessions



app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if username exists
        const checkQuery = 'SELECT * FROM kasutajad WHERE email = ?';
        db.query(checkQuery, [email], async (checkErr, checkResults) => {
            if (checkErr) {
                console.error('Error checking existing username:', checkErr);
                res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
            } else {
                if (checkResults.length === 0) {
                    // Username does not exist
                    res.status(400).json({ success: false, message: 'Emailiga pole registreeritud!' });
                } else {
                    // Check if password is correct
                    const user = checkResults[0];
                    const passwordCorrect = await bcrypt.compare(password, user.parool);

                    if (passwordCorrect) {
                        // Generate a random session token using uuid
                        const sessionToken = uuid.v4();

                        // Store user_id, email, and session token in the session
                        req.session.user = {
                            userId: user.kasutaja_id,
                            email: user.email,
                            sessionToken: sessionToken
                        };

                        // Store the session information in the sessions object
                        sessions.push({
                            userId: user.kasutaja_id,
                            email: user.email,
                            sessionToken: sessionToken
                            // Add more user-related information if needed
                        });



                        console.log('User logged in successfully');
                        res.json({ success: true, message: 'Kasutaja sisselogimine õnnestus!' });
                    } else {
                        res.status(400).json({ success: false, message: 'Ebakorrektne parool!' });
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error comparing passwords:', error);
        res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
    }
});



app.get('/logout', (req, res) => {
    // Find the index of the user's session in the sessions array
    const sessionIndex = sessions.findIndex(session =>
        session.userId === req.session.user.userId && session.sessionToken === req.session.user.sessionToken
    );

    if (sessionIndex !== -1) {
        // Remove the user's session from the sessions array
        sessions.splice(sessionIndex, 1);
    }

    // Destroy the user session
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
        } else {
            console.log('User logged out successfully');
            res.json({ success: true, message: 'Kasutaja välja logitud!' });
        }
    });
});


//admin view for active-sessions
app.get('/active-sessions', (req, res) => {
    res.json({ activeSessions: sessions });
    console.log(sessions);
});

app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}/`);
});
