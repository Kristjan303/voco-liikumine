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


const renderFile = (page, userRole) => async (req, res) => {
    // Check if the user is logged in
    if (req.session.user) {
        const userId = req.session.user.userId;
        const userRoleQuery = 'SELECT rolli_id FROM kasutajad WHERE kasutaja_id = ?';

        db.query(userRoleQuery, [userId], (err, results) => {
            if (err) {
                console.error('Error fetching user role:', err);
                res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
            } else {
                const userRole = results[0].rolli_id;

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


// Render the admin page

app.get('/admin', renderFile('admin'));


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

                    // Store the session information in the sessions object with current time
                    const currentTime = new Date().toISOString();
                    sessions.push({
                        userId: user.kasutaja_id,
                        email: user.email,
                        sessionToken: sessionToken,
                        pushTime: currentTime // Current time

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

        // Check if summernoteContent is '<p><br></p>'
        if (summernoteContent.trim() === '<p><br></p>') {
            console.log('Summernote content cannot be empty');
            return res.status(400).json({ success: false, message: 'Artikkel ei tohi olla tühi!' });
        }

        // Sanitize summernoteContent to remove <script> elements
        const sanitizedContent = summernoteContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        const headerSql = "SELECT artikli_pealkiri FROM vocoliikumine.artiklid WHERE artikli_pealkiri = ?";
        db.query(headerSql, [newArticleHeader], (err, headerResult) => {

            if (headerResult.length > 0 && newArticleHeader === headerResult[0].artikli_pealkiri) {
                console.log('Artikkel on juba olemas');
                return res.status(400).json({ success: false, message: 'Artikkel on juba olemas!' });
            } else {
                if (headerResult.length === 0) {
                    // No matching articles found, proceed with insertion
                    const sql = "INSERT INTO vocoliikumine.artiklid (kasutaja_id, artikli_pealkiri, artikli_sisu, postitamise_kuupäev) VALUES (?, ?, ?, NOW())";
                    db.query(sql, [userId, newArticleHeader, sanitizedContent], (err, result) => {
                        if (err) {
                            console.error('Error inserting data:', err);
                            res.status(500).json({ success: false, message: 'Error inserting data' });
                        } else {
                            console.log('Data inserted successfully');
                            res.status(200).json({ success: true, message: 'Data inserted successfully' });
                        }
                    });
                } else {
                    // Article with the same header already exists, return appropriate error message
                    console.log('Article with the same header already exists');
                    return res.status(400).json({ success: false, message: 'Artikli pealkiri on juba olemas!' });
                }
            }


        });
    });
});


// Add an endpoint to fetch articles
app.get('/get-articles',  (req, res) => {
    // Query to retrieve articles from the database
    const sql = "SELECT a.artikli_pealkiri AS articleHeader, a.artikli_sisu AS summernoteContent, k.kasutajanimi AS articleAuthor, DATE_FORMAT(a.postitamise_kuupäev, '%d-%m-%Y') as articleDate FROM vocoliikumine.artiklid a JOIN vocoliikumine.kasutajad k ON a.kasutaja_id = k.kasutaja_id ORDER BY a.postitamise_kuupäev DESC";
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching articles:', err);
            return res.status(500).json({ success: false, message: 'Error fetching articles' });
        }

// Transform the result to include the URLs for articles
        const articlesWithUrls = result.map(article => {
            const articleHeader = encodeURIComponent(article.articleHeader);
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
    const sql = "SELECT a.artikli_sisu AS summernoteContent, k.kasutajanimi AS articleAuthor, DATE_FORMAT(a.postitamise_kuupäev, '%d-%m-%Y') AS articleDate FROM vocoliikumine.artiklid a JOIN vocoliikumine.kasutajad k ON a.kasutaja_id = k.kasutaja_id WHERE a.artikli_pealkiri = ?";
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
        const articleDate = result[0].articleDate;

        const wrappedContent = `<div class="wrappedContent"><p class="articleHeader">${articleHeader}</p> <div class="hold-article">${articleContent}</div></p>`;

        // Check if the user is logged in
        if (req.session.user) {
            const userId = req.session.user.userId;
            const userRoleQuery = 'SELECT rolli_id FROM kasutajad WHERE kasutaja_id = ?';

            db.query(userRoleQuery, [userId], (err, results) => {
                if (err) {
                    console.error('Error fetching user role:', err);
                    res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
                } else {
                    const userRole = results[0].rolli_id;
                    res.render('artikkel', {
                        articleHeader: articleHeader,
                        articleAuthor: articleAuthor,
                        articleDate: articleDate,
                        wrappedContent: wrappedContent,
                        articleContent: articleContent,
                        userRole: userRole
                    });
                }
            });
        } else {
            // User not logged in; render without userRole
            res.render('artikkel', {
                articleHeader: articleHeader,
                articleAuthor: articleAuthor,
                articleDate: articleDate,
                wrappedContent: wrappedContent,
userRole: 0            });
        }
    });
});

// Endpoint to handle updating Summernote content
app.post('/update-articles', (req, res) => {
    // Extract content from the request body
    const { articleHeader, articleContent, editArticleHeader } = req.body;

    // Sanitize articleContent to remove <script> elements
    const sanitizedContent = articleContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // SQL query to retrieve the existing content from the database
    const sqlRetrieve = 'SELECT artikli_sisu FROM artiklid WHERE artikli_pealkiri = ?';

    // Execute the SQL query to retrieve existing content
    db.query(sqlRetrieve, [articleHeader], (error, results, fields) => {
        if (error) {
            // If an error occurs, send an error response
            console.error('Error retrieving existing content:', error);
            res.status(500).json({ error: 'An error occurred while retrieving existing content.' });
        } else {
            // If retrieval was successful
            if (results.length > 0) {
                const existingContent = results[0].artikli_sisu;
                // Check if the new content is the same as the existing content
                if (existingContent === sanitizedContent && articleHeader === editArticleHeader) {
                    // If content is the same, inform frontend that no changes were made
                    res.json({ success: false, message: 'No changes were made to the article content.' });
                } else {
                    // SQL query to update the content in the database
                    const sqlUpdate = 'UPDATE artiklid SET artikli_sisu = ?, artikli_pealkiri = ? WHERE artikli_pealkiri = ?';

                    // Execute the SQL query to update the content
                    db.query(sqlUpdate, [sanitizedContent, editArticleHeader, articleHeader], (error, results, fields) => {
                        if (error) {
                            // If an error occurs, send an error response
                            console.error('Error updating content:', error);
                            res.status(500).json({ error: 'An error occurred while updating content.' });
                        } else {
                            // If the update was successful, send a success response
                            console.log('Content updated successfully.');
                            res.json({ success: true });
                        }
                    });
                }
            } else {
                // If no existing content found, send an error response
                res.status(404).json({ error: 'No existing content found for the provided article header.' });
            }
        }
    });
});


app.post('/submit-post', (req, res) => {
    const { postTitle, postContent, sessionToken, userId, email } = req.body;

    // Check if the session exists based on the userId and sessionToken
    const validSession = sessions.find(session => session.userId == userId && session.email === email && session.sessionToken == sessionToken);

    if (!validSession) {
        console.log('Invalid session');
        return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    // Check if postTitle or postContent is empty
    if (!postTitle.trim() || !postContent.trim()) {
        console.log('Post title or content is empty');
        return res.status(400).json({ success: false, message: 'Postituse pealkiri ega sisu ei tohi olla tühi!' });
    }

    // Check if the post title already exists
    const titleCheckQuery = "SELECT * FROM foorum WHERE postituse_pealkiri = ?";
    db.query(titleCheckQuery, [postTitle], (titleCheckErr, titleCheckResults) => {
        if (titleCheckErr) {
            console.error('Error checking post title:', titleCheckErr);
            return res.status(500).json({ success: false, message: 'Error checking post title' });
        }

        if (titleCheckResults.length > 0) {
            console.log('Post title already exists');
            return res.status(400).json({ success: false, message: 'Postituse pealkiri juba eksisteerib!' });
        }

        // Construct MySQL query to insert the post data
        const sql = "INSERT INTO foorum (kasutaja_id, postituse_pealkiri, foorumi_sisu, postitamise_kuupäev) VALUES (?, ?, ?, NOW())";

        // Execute the query to insert the post
        db.query(sql, [userId, postTitle, postContent], (insertErr, insertResult) => {
            if (insertErr) {
                console.error('Error inserting data:', insertErr);
                return res.status(500).json({ success: false, message: 'Error inserting data' });
            }

            console.log('Post inserted successfully');
            return res.status(200).json({ success: true, message: 'Post inserted successfully' });
        });
    });
});

// Add an endpoint to fetch posts
app.get('/get-posts', (req, res) => {
    // Query to retrieve posts from the database joined with user's name and count of comments
    const sql = `
        SELECT 
            f.postituse_pealkiri AS postTitle, 
            f.foorumi_sisu AS postContent, 
            k.kasutajanimi AS userName, 
            f.postitamise_kuupäev as postDate,
            COUNT(c.kommentaari_id) AS commentCount
        FROM 
            foorum f 
        JOIN 
            kasutajad k ON f.kasutaja_id = k.kasutaja_id
        LEFT JOIN 
            foorumi_kommentaariumid c ON f.postituse_id = c.postituse_id
        GROUP BY 
            f.postituse_id
        ORDER BY 
            f.postitamise_kuupäev DESC`;

    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching posts:', err);
            return res.status(500).json({ success: false, message: 'Error fetching posts' });
        }

        // Transform the result to include the URLs for each post
        const postsWithUrls = result.map(post => {
            const postTitle = encodeURIComponent(post.postTitle);
            // Create the URL for each post
            const url = `/${postTitle}`;
            return { ...post, url };
        });
        res.status(200).json(postsWithUrls);
    });
});



app.get('/foorum/:postTitle', (req, res) => {
    const postTitle = req.params.postTitle;

    // Query to retrieve a specific post content based on the title
    const sql = "SELECT f.foorumi_sisu AS postContent, k.kasutajanimi AS userName, f.postitamise_kuupäev as postDate, f.kasutaja_id as authorId FROM foorum f JOIN kasutajad k ON f.kasutaja_id = k.kasutaja_id WHERE f.postituse_pealkiri = ?";
    db.query(sql, [postTitle], (err, result) => {
        if (err) {
            console.error('Error fetching post content:', err);
            return res.status(500).json({ success: false, message: 'Error fetching post content' });
        }

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        const postContent = result[0].postContent;
        const userName = result[0].userName;
        const postDateTime = result[0].postDate.toLocaleString('et-EE', { dateStyle: 'medium', timeStyle: 'medium' }); // Formatting date and time according to Estonian standards
        const authorId = result[0].authorId;

        // Check if the user is logged in
        if (req.session.user) {
            const userId = req.session.user.userId;
            const userRoleQuery = 'SELECT rolli_id FROM kasutajad WHERE kasutaja_id = ?';

            db.query(userRoleQuery, [userId], (err, results) => {
                if (err) {
                    console.error('Error fetching user role:', err);
                    res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
                } else {
                    const userRole = results[0].rolli_id;
                    let isAuthor = false;
                    if (userId === authorId) {
                        isAuthor = true;
                    }
                    res.render('postitus', {
                        postTitle: postTitle,
                        postContent: postContent,
                        userName: userName,
                        postDate: postDateTime,
                        userRole: userRole,
                        isAuthor: isAuthor
                    });
                }
            });
        } else {
            let isAuthor = false;
            // User not logged in; render without userRole and isAuthor
            res.render('postitus', {
                postTitle: postTitle,
                postContent: postContent,
                userName: userName,
                postDate: postDateTime,
                userRole: 0,
                isAuthor: isAuthor
            });
        }
    });
});



app.post('/submit-comment', (req, res) => {
    const { postComment, postTitle, email, userId, sessionToken } = req.body;

    // Check if the session exists based on the userId and sessionToken
    const validSession = sessions.find(session => session.userId == userId && session.email === email && session.sessionToken == sessionToken);

    if (!validSession) {
        console.log('Invalid session');
        return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    // Fetch the postituse_id based on postTitle
    const postIdQuery = "SELECT postituse_id FROM foorum WHERE postituse_pealkiri = ?";
    db.query(postIdQuery, [postTitle], (postIdErr, postIdResult) => {
        if (postIdErr) {
            console.error('Error fetching post ID:', postIdErr);
            return res.status(500).json({ success: false, message: 'Error fetching post ID' });
        }

        const postituse_id = postIdResult[0].postituse_id;

        // Construct MySQL query to insert the comment data
        const sql = "INSERT INTO foorumi_kommentaariumid (kasutaja_id, kommentaari_sisu, kommentaari_lisamise_kuupäev, postituse_id) VALUES (?, ?, NOW(), ?)";

        // Execute the query to insert the comment
        db.query(sql, [userId, postComment, postituse_id], (insertErr, insertResult) => {
            if (insertErr) {
                console.error('Error inserting comment:', insertErr);
                return res.status(500).json({ success: false, message: 'Error inserting comment' });
            }

            console.log('Comment inserted successfully');
            return res.status(200).json({ success: true, message: 'Comment inserted successfully' });
        });
    });
});

app.get('/get-comments', (req, res) => {
    const postTitle = req.query.postTitle;

    // Query to retrieve the post ID based on the post title
    const postQuery = "SELECT postituse_id FROM foorum WHERE postituse_pealkiri = ?";
    db.query(postQuery, [postTitle], (err, result) => {
        if (err) {
            console.error('Error fetching post ID:', err);
            return res.status(500).json({ success: false, message: 'Error fetching post ID' });
        }

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        const postId = result[0].postituse_id;

        // Query to retrieve comments based on the post ID
        const commentsQuery = "SELECT k.kasutajanimi AS commenterName, fk.kommentaari_sisu AS commentContent, fk.kommentaari_lisamise_kuupäev AS commentDate, fk.esiletõstetud as highComment, fk.kommentaari_id as commentId FROM foorumi_kommentaariumid fk JOIN kasutajad k ON fk.kasutaja_id = k.kasutaja_id WHERE fk.postituse_id = ?";
        db.query(commentsQuery, [postId], (err, result) => {
            if (err) {
                console.error('Error fetching comments:', err);
                return res.status(500).json({ success: false, message: 'Error fetching comments' });
            }

            res.status(200).json(result);
        });
    });
});

app.post('/pin-comment', (req, res) => {
    const { commentId, commenterName, email, sessionToken, userId } = req.body;

    const validSession = sessions.find(session => session.userId == userId && session.email === email && session.sessionToken == sessionToken);

    if (!validSession) {
        console.log('Invalid session');
        return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    // Query to join tables and get kasutaja_id from kasutajad table based on commenterName
    const userIdQuery = "SELECT kasutaja_id FROM kasutajad WHERE kasutajanimi = ?";
    db.query(userIdQuery, [commenterName], (err, result) => {
        if (err) {
            console.error('Error fetching user ID:', err);
            return res.status(500).json({ success: false, message: 'Error fetching user ID' });
        }

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userId = result[0].kasutaja_id;

        // Query to toggle the value of esiletõstetud column
        const updateQuery = "UPDATE foorumi_kommentaariumid SET esiletõstetud = CASE WHEN esiletõstetud = 1 THEN 0 ELSE 1 END WHERE kommentaari_id = ? AND kasutaja_id = ?";
        db.query(updateQuery, [commentId, userId], (err, result) => {
            if (err) {
                console.error('Error updating comment:', err);
                return res.status(500).json({ success: false, message: 'Error updating comment' });
            }

            res.status(200).json({ success: true, message: 'Comment updated successfully' });
        });
    });
});


app.post('/get-user-posts', (req, res) => {
    const { userId, email, sessionToken } = req.body;

    // Check if userId, email, and sessionToken are provided
    if (!userId || !email || !sessionToken) {
        return res.status(400).json({ success: false, message: 'Invalid session data' });
    }

    const validSession = sessions.find(session => session.userId == userId && session.email === email && session.sessionToken == sessionToken);

    if (!validSession) {
        console.log('Invalid session');
        return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    // Query to retrieve posts titles and dates posted by the user
    const sql = `
        SELECT
            postituse_pealkiri AS postTitle,
            postitamise_kuupäev AS postDate
        FROM
            foorum
        WHERE
            kasutaja_id = ?`;

    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.error('Error fetching user posts:', err);
            return res.status(500).json({ success: false, message: 'Error fetching user posts' });
        }

        // Transform the result to include the titles, dates, and URLs for each post
        const userPosts = result.map(post => {
            const postTitle = encodeURIComponent(post.postTitle);
            const url = `/foorum/${postTitle}`;
            return { title: post.postTitle, url, date: post.postDate };
        });

        res.status(200).json(userPosts);
    });
});
app.post('/get-user-comments', (req, res) => {
    const { userId, email, sessionToken } = req.body;

    // Check if userId, email, and sessionToken are provided
    if (!userId || !email || !sessionToken) {
        return res.status(400).json({ success: false, message: 'Invalid session data' });
    }

    const validSession = sessions.find(session => session.userId == userId && session.email === email && session.sessionToken == sessionToken);

    if (!validSession) {
        console.log('Invalid session');
        return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    // Query to retrieve comments posted by the user
    const commentsQuery = `
        SELECT 
            foorumi_kommentaariumid.kommentaari_id AS id,
            foorumi_kommentaariumid.kommentaari_lisamise_kuupäev AS date,
            foorum.postituse_pealkiri AS title
        FROM 
            foorumi_kommentaariumid
        INNER JOIN 
            foorum 
        ON 
            foorumi_kommentaariumid.postituse_id = foorum.postituse_id
        WHERE 
            foorumi_kommentaariumid.kasutaja_id = ?`;

    db.query(commentsQuery, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching user comments:', err);
            return res.status(500).json({ success: false, message: 'Error fetching user comments' });
        }

        // Transform the result to include the titles, dates, and URLs for each comment
        const userComments = results.map(comment => {
            const postTitle = encodeURIComponent(comment.title);
            const url = `/foorum/${postTitle}`;
            return { title: comment.title, url, date: comment.date };
        });

        res.status(200).json(userComments);
    });
});

app.post('/submit-news', (req, res) => {
    const { newNewsHeader, summernoteContent, sessionToken, userId, email } = req.body;

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

        // Check if newNewsHeader or summernoteContent is empty
        if (!newNewsHeader || !summernoteContent) {
            console.log('New article header or summernote content is empty');
            return res.status(400).json({ success: false, message: 'Uue uudise pealkiri või sisu ei tohi olla tühi!' });
        }

        // Check if summernoteContent is '<p><br></p>'
        if (summernoteContent.trim() === '<p><br></p>') {
            console.log('Summernote content cannot be empty');
            return res.status(400).json({ success: false, message: 'uudis ei tohi olla tühi!' });
        }

        // Remove <script> elements from summernoteContent
        const sanitizedContent = summernoteContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        const headerSql = "SELECT uudise_pealkiri FROM vocoliikumine.uudised WHERE uudise_pealkiri = ?";
        db.query(headerSql, [newNewsHeader], (err, headerResult) => {

            if (headerResult.length > 0 && newNewsHeader === headerResult[0].uudise_pealkiri) {
                console.log('uudis on juba olemas');
                return res.status(400).json({ success: false, message: 'uudis on juba olemas!' });
            } else {
                if (headerResult.length === 0) {
                    // No matching news found, proceed with insertion
                    const sql = "INSERT INTO vocoliikumine.uudised (kasutaja_id, uudise_pealkiri, uudise_sisu, postitamise_kuupäev) VALUES (?, ?, ?, NOW())";
                    db.query(sql, [userId, newNewsHeader, sanitizedContent], (err, result) => {
                        if (err) {
                            console.error('Error inserting data:', err);
                            res.status(500).json({ success: false, message: 'Error inserting data' });
                        } else {
                            console.log('Data inserted successfully');
                            res.status(200).json({ success: true, message: 'Data inserted successfully' });
                        }
                    });
                } else {
                    // news with the same header already exists, return appropriate error message
                    console.log('Article with the same header already exists');
                    return res.status(400).json({ success: false, message: 'uudise pealkiri on juba olemas!' });
                }
            }
        });
    });
});


app.get('/get-news',  (req, res) => {
    // Query to retrieve news from the database
    const sql = "SELECT u.uudise_pealkiri AS newsHeader, u.uudise_sisu AS summernoteContent, k.kasutajanimi AS newsAuthor, DATE_FORMAT(u.postitamise_kuupäev, '%d-%m-%Y') as newsDate FROM vocoliikumine.uudised u JOIN vocoliikumine.kasutajad k ON u.kasutaja_id = k.kasutaja_id ORDER BY u.postitamise_kuupäev DESC;"

// Now you can use the "sql" variable in your code as needed.
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching news:', err);
            return res.status(500).json({ success: false, message: 'Error fetching news' });
        }

// Transform the result to include the URLs for news
        const newsWithUrls = result.map(news => {
            const newsHeader = encodeURIComponent(news.newsHeader);
            // Create the URL for each news
            const url = `/uudised/${newsHeader}`;
            return { ...news, url };
        });

        res.status(200).json(newsWithUrls);
    });
});

app.get('/uudised/:newsHeader', (req, res) => {
    const newsHeader = req.params.newsHeader;

    // Query to retrieve a specific news content based on the header
    const sql = "SELECT u.uudise_sisu AS summernoteContent, k.kasutajanimi AS newsAuthor, DATE_FORMAT(u.postitamise_kuupäev, '%d-%m-%Y') AS newsDate FROM vocoliikumine.uudised u JOIN vocoliikumine.kasutajad k ON u.kasutaja_id = k.kasutaja_id WHERE u.uudise_pealkiri = ?";
    db.query(sql, [newsHeader], (err, result) => {
        if (err) {
            console.error('Error fetching news content:', err);
            return res.status(500).json({ success: false, message: 'Error fetching news content' });
        }

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'news not found' });
        }

        const newsContent = result[0].summernoteContent;
        const newsAuthor = result[0].newsAuthor;
        const newsDate = result[0].newsDate;

        const wrappedContent = `<div class="wrappedContent"><p class="newsHeader">${newsHeader}</p> <div class="hold-news">${newsContent}</div></p>`;

        // Check if the user is logged in
        if (req.session.user) {
            const userId = req.session.user.userId;
            const userRoleQuery = 'SELECT rolli_id FROM kasutajad WHERE kasutaja_id = ?';

            db.query(userRoleQuery, [userId], (err, results) => {
                if (err) {
                    console.error('Error fetching user role:', err);
                    res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
                } else {
                    const userRole = results[0].rolli_id;
                    res.render('uudis', {
                        newsHeader: newsHeader,
                        newsAuthor: newsAuthor,
                        newsDate: newsDate,
                        wrappedContent: wrappedContent,
                        newsContent: newsContent,
                        userRole: userRole
                    });
                }
            });
        } else {
            // User not logged in; render without userRole
            res.render('uudis', {
                newsHeader: newsHeader,
                newsAuthor: newsAuthor,
                newsDate: newsDate,
                wrappedContent: wrappedContent,
                userRole: 0            });
        }
    });
});
app.post('/update-news', (req, res) => {
    // Extract content from the request body
    const { newsHeader, newsContent, editNewsHeader } = req.body;

    // Sanitize newsContent to remove <script> elements
    const sanitizedContent = newsContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // SQL query to retrieve the existing content from the database
    const sqlRetrieve = 'SELECT uudise_sisu FROM uudised WHERE uudise_pealkiri = ?';

    // Execute the SQL query to retrieve existing content
    db.query(sqlRetrieve, [newsHeader], (error, results, fields) => {
        if (error) {
            // If an error occurs, send an error response
            console.error('Error retrieving existing content:', error);
            res.status(500).json({ error: 'An error occurred while retrieving existing content.' });
        } else {
            // If retrieval was successful
            if (results.length > 0) {
                const existingContent = results[0].uudise_sisu;
                // Check if the new content is the same as the existing content
                if (existingContent === sanitizedContent && newsHeader === editNewsHeader) {
                    // If content is the same, inform frontend that no changes were made
                    res.json({ success: false, message: 'No changes were made to the news content.' });
                } else {
                    // SQL query to update the content in the database
                    const sqlUpdate = 'UPDATE uudised SET uudise_sisu = ?, uudise_pealkiri = ? WHERE uudise_pealkiri = ?';

                    // Execute the SQL query to update the content
                    db.query(sqlUpdate, [sanitizedContent, editNewsHeader, newsHeader], (error, results, fields) => {
                        if (error) {
                            // If an error occurs, send an error response
                            console.error('Error updating content:', error);
                            res.status(500).json({ error: 'An error occurred while updating content.' });
                        } else {
                            // If the update was successful, send a success response
                            console.log('Content updated successfully.');
                            res.json({ success: true });
                        }
                    });
                }
            } else {
                // If no existing content found, send an error response
                res.status(404).json({ error: 'No existing content found for the provided news header.' });
            }
        }
    });
});



// Render the admin page or redirect to /sisene if not authenticated
app.get('/admin', (req, res) => {
    // Check if the user is logged in
    if (req.session.user) {
        const userId = req.session.user.userId;
        const userRoleQuery = 'SELECT rolli_id FROM kasutajad WHERE kasutaja_id = ?';

        db.query(userRoleQuery, [userId], (err, results) => {
            if (err) {
                console.error('Error fetching user role:', err);
                res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
            } else {
                const userRole = results[0].rolli_id;

                // Render admin page with userRole
                res.render('admin', { userRole });
            }
        });
    } else {
        const userRole = null; // Assuming userRole is not relevant if the user is not authenticated
        res.render('admin', { userRole });
    }
});

// Endpoint to retrieve data from the 'kasutajad' table
app.get('/kasutajad', (req, res) => {
    const query = 'SELECT k.*, r.rolli_nimetus FROM kasutajad k JOIN rollid r ON k.rolli_id = r.rolli_id';
    db.query(query, (error, results, fields) => {
        if (error) {
            console.error('Error executing query:', error);
            res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
            return;
        }
        res.json(results);
    });
});

app.get('/sessions', (req, res) => {
    const userIds = sessions.map(session => session.userId);
    const query = 'SELECT kasutaja_id, kasutajanimi FROM kasutajad WHERE kasutaja_id IN (?)';
    db.query(query, [userIds], (error, results) => {
        if (error) {
            console.error('Error fetching usernames:', error);
            res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
            return;
        }
        // Map usernames to their corresponding sessions
        const sessionData = sessions.map(session => {
            const user = results.find(user => user.kasutaja_id === session.userId);
            const username = user ? user.kasutajanimi : 'Unknown';
            return {
                userId: session.userId,
                username: username,
                pushTime: session.pushTime,
            };
        });
        res.json(sessionData);
    });
});



// Endpoint to logout a specific user
// app.get('/logout/:username', (req, res) => {
//     const username = req.params.username;
//
//
//     // First, query the kasutajad table to get the userId
//     db.query('SELECT kasutaja_id FROM kasutajad WHERE kasutajanimi = ?', [username], (err, results) => {
//         if (err) {
//             console.error('Error querying kasutajad table:', err);
//             return res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
//         }
//
//         if (results.length === 0) {
//             // If no user found with the provided username
//             return res.status(404).json({ success: false, message: 'Kasutajat ei leitud!' });
//         }
//
//         const userId = results[0].kasutaja_id; // Use the correct column name
//
//         // Find the index of the session corresponding to the userId
//         const sessionIndex = sessions.findIndex(session => session.userId === userId);
//
//         if (sessionIndex !== -1) {
//             req.session.destroy(err => {
//                 if (err) {
//                     console.error('Error destroying session:', err);
//                     return res.status(500).json({ success: false, message: 'Serveripoolne viga!' });
//                 }
//                 console.log('User logged out successfully:', username);
//                 sessions.splice(sessionIndex, 1);
//                 return res.json({ success: true, message: 'Kasutaja välja logitud!' });
//             });
//         } else {
//             return res.status(404).json({ success: false, message: 'Sessiooni ei leitud!' });
//         }
//
//     });
// });



app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}/`);
});
