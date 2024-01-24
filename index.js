const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path'); // Import the path module

const app = express();
const port = 3000;

// Configure MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'qwerty',
    database: 'vocoliikumine',
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        throw err;
    }
    console.log('Connected to MySQL database');
});

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Serve static files (HTML in this case)
app.use(express.static(path.join(__dirname, 'public')));

// Login endpoint
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Check if user exists in the database
    db.query(
        'SELECT * FROM kasutajad WHERE email = ? AND parool = ?',
        [email, password],
        (err, results) => {
            if (err) {
                console.error('Error executing login query:', err);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            if (results.length > 0) {
                res.json({ message: 'Login successful' });
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        }
    );
});

// Register endpoint
app.post('/register', (req, res) => {
    const { rolli_id, Kasutajanimi, parool, telefon, email } = req.body;

    // Insert new user into the database
    db.query(
        'INSERT INTO kasutajad (rolli_id, Kasutajanimi, parool, telefon, email) VALUES (?, ?, ?, ?, ?)',
        [rolli_id, Kasutajanimi, parool, telefon, email],
        (err) => {
            if (err) {
                console.error('Error executing registration query:', err);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            res.json({ message: 'Registration successful' });
        }
    );
});

app.use('/css', express.static(path.join(__dirname, 'css')));

// Handle the root path
app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}/`);
});
