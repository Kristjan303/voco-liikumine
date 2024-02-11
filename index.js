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

// Increase payload size limit
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
    const { newDirectoryName, userId, sessionToken, email } = req.body;

    // Check if the session exists in the sessions array
    const validSession = sessions.find(session => session.userId == userId && session.email === email && session.sessionToken == sessionToken);

    if (!validSession) {
        console.log('Invalid session');
        return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    // Query to retrieve user's role_id from the database
    const roleSql = "SELECT rolli_id FROM vocoliikumine.kasutajad WHERE kasutaja_id = ?";
    db.query(roleSql, [userId], (roleErr, roleResult) => {
        if (roleErr) {
            console.error('Error fetching user role:', roleErr);
            return res.status(500).json({ success: false, message: 'Error fetching user role' });
        }

        if (roleResult.length === 0) {
            console.log('User not found');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const roleId = roleResult[0].rolli_id;

        // Check if the user's role_id is not 2 or 3
        if (roleId !== 2 && roleId !== 3) {
            console.log('User does not have appropriate role');
            return res.status(403).json({ success: false, message: 'User does not have appropriate role' });
        }

        if (!newDirectoryName) {
            return res.status(400).json({ success: false, message: 'Sisesta kausta nimi!' });
        }

        const newDirectoryPath = path.join(__dirname, 'Galerii', newDirectoryName);

        if (fs.existsSync(newDirectoryPath)) {
            return res.status(400).send('Kaust juba eksisteerib!');
        }

        try {
            fs.mkdirSync(newDirectoryPath);
            res.status(200).send('Kaust loodud!');
        } catch (error) {
            console.error('Error creating directory:', error);
            res.status(500).send('Serveri viga!');
        }
    });
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
    const { sessionToken, userId, email } = req.body;

    // Check if the session exists in the sessions array
    const validSession = sessions.find(session => session.userId == userId && session.email === email && session.sessionToken == sessionToken);

    if (!validSession) {
        console.log('Invalid session');
        return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    // Query to retrieve user's role_id from the database
    const roleSql = "SELECT rolli_id FROM vocoliikumine.kasutajad WHERE kasutaja_id = ?";
    db.query(roleSql, [userId], (roleErr, roleResult) => {
        if (roleErr) {
            console.error('Error fetching user role:', roleErr);
            return res.status(500).json({ success: false, message: 'Error fetching user role' });
        }

        if (roleResult.length === 0) {
            console.log('User not found');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const roleId = roleResult[0].rolli_id;

        // Check if the user's role_id is not 2 or 3
        if (roleId !== 2 && roleId !== 3) {
            console.log('User does not have appropriate role');
            return res.status(403).json({ success: false, message: 'User does not have appropriate role' });
        }

        // Retrieve uploaded files and their paths
        const files = req.files;
        const folder = req.body.folder;

        // Insert records into the database for each uploaded file
        files.forEach(file => {
            const filePath = path.join('/galerii', folder, file.filename); // Relative path from /galerii directory
            const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

            // Insert record into the database
            const insertQuery = 'INSERT INTO vocoliikumine.galerii (kasutaja_id, media, lisamise_kuupäev) VALUES (?, ?, ?)';
            db.query(insertQuery, [userId, filePath, currentDate], (err, results) => {
                if (err) {
                    console.error('Error inserting record into database:', err);
                    // Handle error response
                } else {
                    // Handle success response
                }
            });
        });

        res.json({ message: 'Files uploaded successfully!' });
    });
});

app.get('/galerii/images', (req, res) => {
    const folder = req.query.folder;

    if (!folder) {
        return res.status(400).json({ success: false, message: 'Kaust pole valitud!' });
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

// Backend route to fetch the latest uploaded images
app.get('/galerii/latest-images', (req, res) => {
    // Fetch the latest 10 uploaded images from the database
    const query = 'SELECT media FROM vocoliikumine.galerii ORDER BY lisamise_kuupäev DESC LIMIT 10'; // Changed to ASC
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching latest images:', err);
            res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
        } else {
            // Reverse the order of the results to have the newest images first
            const latestImages = results.map(row => `${row.media}`).reverse(); // Reverse the order
            res.json({ success: true, latestImages });
        }
    });
});

app.post('/submit-article', (req, res) => {
    const { newArticleHeader, summernoteContent, sessionToken, userId, email } = req.body;

    // Check if the session exists in the sessions array
    const validSession = sessions.find(session => session.userId == userId && session.email === email && session.sessionToken == sessionToken);

    if (!validSession) {
        console.log('Invalid session');
        return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    // Query to retrieve user's role_id from the database
    const roleSql = "SELECT rolli_id FROM vocoliikumine.kasutajad WHERE kasutaja_id = ?";
    db.query(roleSql, [userId], (roleErr, roleResult) => {
        if (roleErr) {
            console.error('Error fetching user role:', roleErr);
            return res.status(500).json({ success: false, message: 'Error fetching user role' });
        }

        if (roleResult.length === 0) {
            console.log('User not found');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const roleId = roleResult[0].rolli_id;

        // Check if the user's role_id is not 2 or 3
        if (roleId !== 2 && roleId !== 3) {
            console.log('User does not have appropriate role');
            return res.status(403).json({ success: false, message: 'User does not have appropriate role' });
        }

        // Check if newArticleHeader or summernoteContent is empty
        if (!newArticleHeader || !summernoteContent) {
            console.log('New article header or summernote content is empty');
            return res.status(400).json({ success: false, message: 'Uue artikli pealkiri või sisu ei tohi olla tühi!' });
        }

        // Insert data into MySQL table
        const sql = "INSERT INTO vocoliikumine.artiklid (kasutaja_id, artikli_pealkiri, artikli_sisu, postitamise_kuupäev) VALUES (?, ?, ?, NOW())";
        db.query(sql, [userId, newArticleHeader, summernoteContent], (err, result) => {
            if (err) {
                console.error('Error inserting data:', err);
                res.status(500).json({ success: false, message: 'Error inserting data' });
            } else {
                console.log('Data inserted successfully');
                res.status(200).json({ success: true, message: 'Data inserted successfully' });
            }
        });
    });
});

// Add an endpoint to fetch articles
app.get('/get-articles', (req, res) => {
    // Query to retrieve articles from the database
    const sql = "SELECT a.artikli_pealkiri AS articleHeader, a.artikli_sisu AS summernoteContent, k.kasutajanimi AS articleAuthor FROM vocoliikumine.artiklid a JOIN vocoliikumine.kasutajad k ON a.kasutaja_id = k.kasutaja_id";
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching articles:', err);
            return res.status(500).json({ success: false, message: 'Error fetching articles' });
        }

        // Transform the result to include the URLs
        const articlesWithUrls = result.map(article => {
            const articleHeader = article.articleHeader;
            // Create the URL for each article
            const url = `/artiklid/${articleHeader}`;
            return { ...article, url };
        });

        res.status(200).json(articlesWithUrls);
    });
});

// Route for accessing individual articles
app.get('/artiklid/:articleHeader', (req, res) => {
    const articleHeader = req.params.articleHeader;

    // Query to retrieve a specific article content based on the header
    const sql = "SELECT a.artikli_sisu AS summernoteContent, k.kasutajanimi AS articleAuthor FROM vocoliikumine.artiklid a JOIN vocoliikumine.kasutajad k ON a.kasutaja_id = k.kasutaja_id WHERE a.artikli_pealkiri = ?";
    db.query(sql, [articleHeader], (err, result) => {
        if (err) {
            console.error('Error fetching article content:', err);
            return res.status(500).json({ success: false, message: 'Error fetching article content' });
        }

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Article not found' });
        }

        const articleContent = result[0].summernoteContent;
        const articleAuthor = result[0].articleAuthor;
        const wrappedContent = `<div class="wrappedContent"><p class="articleHeader">${articleHeader}</p> <div class="hold-article">${articleContent}</div></p>`;
        res.status(200).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Artiklid 📑 | ${articleHeader}</title>
                <link rel="stylesheet" href="../css/artiklid_html.css">
                <link rel="stylesheet" href="../css/index.css">
                <link rel="stylesheet" href="../css/artiklid.css">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css">
            </head>
            <body>
                <header>
                    <div class="header-links">
                        <a href="https://www.facebook.com/tartuvoco/">
                            <i class="fa-brands fa-square-facebook fa-xl" style="color: #000000;"></i>
                        </a>
                        <a href="https://www.tiktok.com/@tartuvoco?lang=en">
                            <i class="fa-brands fa-tiktok fa-xl" style="color: #000000;"></i>
                        </a>
                        <a href="https://www.instagram.com/tartuvoco/?hl=en">
                            <i class="fa-brands fa-instagram fa-xl" style="color: #000000;"></i>
                        </a>
                    </div>
                    <div class="header-search">
                        <input type="text" placeholder="Otsi...">
                        <button type="submit">
                            <i class="fa-solid fa-search fa-lg" style="color: #000000;"></i>
                        </button>
                        <a id="siseneButton" class="sisene" href="/sisene">Sisene</a>
                    </div>
                </header>
                <nav>
                    <a href="/" class="nav-logo">
                        <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                             viewBox="0 0 412.74 334.7" style="enable-background:new 0 0 412.74 334.7;" xml:space="preserve">
                          <style type="text/css">
                              .st0{fill:#FFFFFF;}
                          </style>
                            <path class="st0" d="M259.98,112.52c0,27.49-22.29,49.78-49.78,49.78c-27.49,0-49.78-22.29-49.78-49.78
                              c0-27.49,22.29-49.78,49.78-49.78C237.69,62.74,259.98,85.02,259.98,112.52 M350.92,223.78c0-27.49-22.29-49.78-49.78-49.78
                              s-49.78,22.29-49.78,49.78c0,27.49,22.29,49.78,49.78,49.78S350.92,251.27,350.92,223.78 M214.48,223.92l35.27-35.27
                              c-9.01-9.05-21.49-14.65-35.27-14.65c-27.49,0-49.78,22.29-49.78,49.78s22.29,49.78,49.78,49.78c13.71,0,26.13-5.54,35.13-14.51
                              L214.48,223.92z M60.31,67.73l52.2,90.51l52.2-90.51H60.31z"/>
                        </svg>
                    </a>
                    <div class="nav-links">
                        <a style="color: #2980b9" href="artiklid">Artiklid</a>
                        <a href="../uudised">Uudised</a>
                        <a href="../foorum">Foorum</a>
                        <a href="../treeningud">Treeningud</a>
                        <a href="../galerii">Galerii</a>
                    </div>
                </nav>
                <section class="artiklid">
                    <div class="section-nav">
                        <div class="path">
                            <p><a href="/">Avaleht</a> > <a href="/artiklid">Artiklid</a> > <span>"${articleHeader}"</span></p>
                        </div>
                        <h1>Artiklid - <span style="font-weight: lighter">"${articleHeader}"</span></h1>
                    </div>
                                   <main class="article">
                                   <p class="articleAuthor">Autor: ${articleAuthor}</p>
                   ${wrappedContent}
               </main>
                </section>
            
            <div class="mapBanner">
            <a href="https://www.google.com/maps?ll=58.349455,26.714113&amp;z=15&amp;t=m&amp;hl=en-US&amp;gl=EG&amp;mapclient=embed&amp;q=Kopli+1+50115+Tartu+Estonia" target="_blank" class="mapBanner_col" style="background-image: url('https://liikumine.voco.ee/wp-content/uploads/sites/11/2023/01/map_1.jpg')">
            Kopli 1
            </a>
            <a href="https://www.google.com/maps/place/P%C3%B5llu+11,+50303+Tartu,+Estonia/@58.3994611,26.7119631,17.25z/data=!4m13!1m7!3m6!1s0x46eb36f49f59f7b1:0xc60a936ef314737f!2sP%C3%B5llu+11,+50303+Tartu,+Estonia" target="_blank" class="mapBanner_col" style="background-image: url('https://liikumine.voco.ee/wp-content/uploads/sites/11/2023/01/map_2.jpg')">
            Põllu 11
            </a>
            </div>
            
            <footer class="footer">
            <div class="container container-footer">
            <div class="footer_content">
                <div class="footer_logoCol">
                    <a href="https://liikumine.voco.ee/" class="footer_logo">
                        <img src="https://liikumine.voco.ee/wp-content/uploads/sites/11/2023/01/VOCO.svg"
                             alt="VOCO Liikumine" class="footer_logoImg">
                    </a>
                </div>
                <div class="footer_mainCol">
                    <div class="footer_grid">
                        <div class="footer_col">
                            <h3 class="footer_title">
                                Kontakt
                            </h3>
                            <div class="footer_text">
                                <p><a href="mailto:info@voco.ee">info@voco.ee</a></p>
                                <p>7 361 810</p>
            
                            </div>
                        </div>
                        <div class="footer_col">
                            <h3 class="footer_title">
                                VOCO
                            </h3>
                            <div class="footer_text">
                                <p>Kopli 1</p>
                                <p>Tartu 50115 Eesti</p>
            
                            </div>
                        </div>
                        <div class="footer_col">
                            <h3 class="footer_title">
                                Privaatsustingimused
                            </h3>
                            <div class="footer_text">
                                <p><a href="#">Andmekaitse</a></p>
                                <p><a href="#">Küpsised</a></p>
            
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
            <div class="footer_bottom">
            © Tartu rakenduslik kolledž 2024
            </div>
            </footer>
            </body>
            </html>
        `);
    });
});


app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}/`);
});
