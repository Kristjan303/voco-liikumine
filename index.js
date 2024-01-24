const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');
const bcrypt = require('bcrypt');


const app = express();
const port = 3000;

// Middleware to parse JSON requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Serve static files (HTML in this case)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'css')));

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'html/index.html'));
});

// sisene
app.get('/sisene', async (req, res) => {
    res.sendFile(path.join(__dirname, 'html/sisene.html'));
});

app.get('/register', async (req, res) => {
    res.sendFile(path.join(__dirname, 'html/register.html'));
});

// Handle the sign-up form submission
app.post('/signup', async (req, res) => {
    const { username, phonenumber, email, password } = req.body;

    try {
        // Check if username or email already exists
        const checkQuery = 'SELECT * FROM kasutajad WHERE kasutajanimi = ? OR email = ?';
        db.query(checkQuery, [username, email], async (checkErr, checkResults) => {
            if (checkErr) {
                console.error('Error checking existing username or email:', checkErr);
                res.status(500).json({ success: false, message: 'Internal Server Error' });
            } else {
                if (checkResults.length > 0) {
                    // Username or email already exists
                    res.status(400).json({ success: false, message: 'Username or email already in use' });
                } else {
                    // Hash the password
                    const hashedPassword = await bcrypt.hash(password, 10);

                    // Insert user data into the database
                    const insertQuery = 'INSERT INTO kasutajad (kasutajanimi, telefon, email, parool) VALUES (?, ?, ?, ?)';
                    db.query(insertQuery, [username, phonenumber, email, hashedPassword], (err, results) => {
                        if (err) {
                            console.error('Error inserting user into database:', err);
                            res.status(500).json({ success: false, message: 'Internal Server Error' });
                        } else {
                            console.log('User signed up successfully');
                            res.json({ success: true, message: 'User signed up successfully' });
                        }
                    });
                }
            }
        });
    } catch (error) {
        console.error('Error hashing password:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}/`);
});
