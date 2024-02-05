const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const session = require('express-session');
const uuid = require('uuid');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');


const app = express();
const port = 3000;


// Set EJS as the view engine
app.set('view engine', 'ejs');

// Middleware to parse JSON requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors());


app.use(session({
    secret: 'your-secret-key', // Replace with a strong and secure secret key
    resave: false,
    saveUninitialized: true
}));



// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/galerii', express.static(path.join(__dirname, 'Galerii')));


const renderFile = (page) => async (req, res) => {
    let userRole;

    // Check if the user is logged in
    if (req.session.user) {
        const userId = req.session.user.userId;
        const userRoleQuery = 'SELECT rolli_id FROM kasutajad WHERE kasutaja_id = ?';

        db.query(userRoleQuery, [userId], (err, results) => {
            if (err) {
                console.error('Error fetching user role:', err);
                res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
            } else {
                userRole = results[0].rolli_id;

                // Render the page and pass the userRole to the EJS template
                res.render(page, { userRole });
            }
        });
    } else {
        // Render the page with userRole set to undefined
        res.render(page, { userRole });
    }
};

app.get('/', renderFile('index'));
app.get('/galerii', renderFile('galerii'));
app.get('/treeningud', renderFile('treeningud'));
app.get('/foorum', renderFile('foorum'));
app.get('/artiklid', renderFile('artiklid'));
app.get('/uudised', renderFile('uudised'));
app.get('/sisene', renderFile('sisene'));
app.get('/register', renderFile('register'));
app.get('/home', renderFile('load'));

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
                return res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
            }

            if (checkResults.length === 0) {
                // Username does not exist
                return res.status(400).json({ success: false, message: 'Emailiga pole registreeritud!' });
            }

            // Check if password is correct
            const user = checkResults[0];
            const passwordCorrect = await bcrypt.compare(password, user.parool);

            if (passwordCorrect) {
                // Fetch the user's rolli_id
                const rolliQuery = 'SELECT rolli_id FROM kasutajad WHERE kasutaja_id = ?';
                db.query(rolliQuery, [user.kasutaja_id], async (rolliErr, rolliResults) => {
                    if (rolliErr) {
                        console.error('Error fetching rolli_id:', rolliErr);
                        return res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
                    }

                    // Generate a random session token using uuid
                    const sessionToken = uuid.v4();

                    req.session.user = {
                        userId: user.kasutaja_id,
                        email: user.email,
                        sessionToken: sessionToken,
                    };

                    // Store the session information in the sessions object
                    sessions.push({
                        userId: user.kasutaja_id,
                        email: user.email,
                        sessionToken: sessionToken,
                        // Add more user-related information if needed
                    });


                    // Send the session information and redirect URL to the frontend
                    res.json({
                        success: true,
                        message: 'Kasutaja sisselogimine õnnestus!',
                        sessionToken: sessionToken,
                        userId: user.kasutaja_id,
                        email: user.email,
                    });
                });
            } else {
                res.status(400).json({ success: false, message: 'Ebakorrektne parool!' });
            }
        });
    } catch (error) {
        console.error('Error comparing passwords:', error);
        res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
    }
});


// Update the server-side code

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
// get folder from folderform

app.post('/create-directory', (req, res) => {
    const newDirectoryName = req.body.newDirectoryName;

    if (!newDirectoryName) {
        return res.status(400).json({ success: false, message: 'sisesta kausta nimi!' });

    }

    const newDirectoryPath = path.join(__dirname, 'Galerii', newDirectoryName);

    if (fs.existsSync(newDirectoryPath)) {
        return res.status(400).send('kaust juba eksisteerbi!');
    }

    try {
        fs.mkdirSync(newDirectoryPath);
        res.status(200).send('Kaust loodud!');
    } catch (error) {
        console.error('Error creating directory:', error);
        res.status(500).send('serveri viga!');
    }
});

app.get('/galerii/folders', (req, res) => {
    const galeriiPath = path.join(__dirname, 'galerii');

    // Read the contents of the 'galerii' directory
    fs.readdir(galeriiPath, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        // Filter out only directories
        const folders = files.filter(file => fs.statSync(path.join(galeriiPath, file)).isDirectory());

        res.json(folders);
    });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use the 'folder' field from the form data to determine the upload directory
        const uploadDir = path.join(__dirname, 'galerii', req.body.folder);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});

const upload = multer({ storage: storage });

// Endpoint for uploading files
app.post('/galerii/upload', upload.array('files'), (req, res) => {
    // Handle the uploaded files as needed
    console.log('Files uploaded to:', req.body.folder);
    res.json({ message: 'Files uploaded successfully!' });
});

app.get('/galerii/images', (req, res) => {
    const folder = req.query.folder;

    if (!folder) {
        return res.status(400).json({ success: false, message: 'Folder not provided!' });
    }

    const folderPath = path.join(__dirname, 'Galerii', folder);

    // Read the contents of the folder
    fs.readdir(folderPath, (err, files) => {
        if (err) {
            console.error('Error reading folder:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        // Filter out only image files with jpg and png extensions
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png)$/i.test(file));

        res.json(imageFiles);
    });
});



app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}/`);
});
