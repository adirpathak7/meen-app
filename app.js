const express = require('express')
const mongoose = require('mongoose');
const Users = require('./models/Users');
const bcryptjs = require('bcryptjs')
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const session = require('express-session')
const multer = require('multer')
const path = require('path')
const { body, validator, validationResult } = require('express-validator');


const app = express()
const SECRET_KEY = 'qims38axkANamx8765ahkjam45aha4qb'

// connection with mongodb
mongoose.connect("mongodb://localhost:27017/meenPrc").then(() => {
    console.log("Database connected.");
}).catch((err) => {
    console.log("Some error occured:- " + err);
})

// jwt token verification
function jwtVerify(req, res, next) {
    console.log("Session token:", req.session.token);  // debug token from session
    console.log("Auth header:", req.headers['authorization']);
    // token comes from request headers
    let token = null;

    if (req.session.token) {
        token = req.session.token;  // session token is just the token string
    } else if (req.headers['authorization']) {
        // Typically 'Bearer <token>'
        token = req.headers['authorization'].split(' ')[1];
    }
    if (!token) {
        console.log('Token is required!');
        return res.status(403).json({ status: 403, message: 'Token is required!' })
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY)
        // console.log('decoded user: ' + req.user);
        req.user = decoded
        next()
    } catch (err) {
        console.log('An error occurred: ' + err);
        res.status(401).json({ status: 401, message: 'Invalid or expired token!' })
    }
}

// multer configration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/')
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname))
    }
})

const uploads = multer({ storage: storage })

// ejs setup
app.set('view engine', 'ejs')

// for json data parsing
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: false }))

// session middlewere
app.use(session({
    secret: 'qims38axkANamx8765ahkjam45aha4qb',
}))

// for fetch file from uploads folder
app.use('/uploads', express.static('uploads'))
// when you are working with backend only and api call will postman
// app.use(express.urlencoded({ extended: true }))

// simple hello world
app.get('/', (req, res) => {
    res.render('index', { message: 'Hello World!' })
})

// for register view on browser
app.get('/register', (req, res) => {
    res.render('register', { errors: [], oldInput: {} })
})

// simple add data
app.post('/register', uploads.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'documents', maxCount: 3 }
]),
    [
        body('username').notEmpty().withMessage('Enter username'),
        body("email").isEmail().withMessage("Enter a valid email"),
        body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
        body("gender").notEmpty().withMessage("Gender is required")
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req)

            if (!errors.isEmpty()) {
                return res.render('register', { errors: errors.array(), oldInput: req.body })
            }
            // for hashing password
            const hashPassword = await bcryptjs.hash(req.body.password, 10)

            const user = new Users({
                username: req.body.username,
                email: req.body.email,
                gender: req.body.gender,
                password: hashPassword,
                profilePic: req.files['profilePic'] ? req.files['profilePic'][0].filename : null,
                documents: req.files['documents'] ? req.files['documents'].map(file => file.filename) : []
            })
            const newUser = await user.save()
            res.render('success', { user: newUser })
            // res.json({ message: "Registration successful", data: newUser });
        } catch (err) {
            console.log('An error occured:- ' + err);
        }
    })

// simple get all data
app.get('/getAllUser', jwtVerify, async (req, res) => {
    try {
        const users = await Users.find().select('-password')
        // res.json(users)
        res.render('users', { users: users })
    } catch (err) {
        console.log('An error occured:- ' + err);
        res.status(500).json({ error: err.message })
    }
})

// for browser
app.get('/login', (req, res) => {
    res.render('login')
})

// simple login via username/email and password
app.post('/login', async (req, res) => {
    try {
        const { usernameOrEmail, password } = req.body;

        const user = await Users.findOne({
            $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }]
        });

        if (!user) {
            return res.status(404).render('login', { error: 'User not found!' });
        }

        const isMatch = await bcryptjs.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).render('login', { error: 'Invalid password!' });
        }

        const token = jwt.sign({
            id: user._id,
            username: user.username,
            email: user.email
        }, SECRET_KEY, { expiresIn: "1h" });

        // Store token + user info in session
        req.session.token = token;
        req.session.user = {
            userId: user._id,
            username: user.username,
            email: user.email,
            gender: user.gender,
            password: user.password,
            profilePic: user.profilePic,
            documents: user.documents
        };

        res.redirect('/dashboard');
    } catch (err) {
        console.log("An error occurred:-", err);
        res.status(500).render('login', { error: 'Server error!' });
    }
})

// ejs dashboard
app.get('/dashboard', (req, res) => {
    if (!req.session.token || !req.session.user) {
        return res.redirect('/login')
    }

    res.render('dashboard', {
        user: req.session.user,
        token: req.session.token
    })
})

// protected route or api
app.get('/profile', jwtVerify, async (req, res) => {
    try {
        // find the user by id and does not select the password
        const user = await Users.findById(req.user.id).select("-password");

        if (!user) {
            return res.json({ status: 404, message: 'User not found!' })
        }
        res.json({ message: 'Profile Data: ', user })
    } catch (err) {
        console.log('An error occurred: ' + err);
        res.json({ status: 500, message: 'Ann error occured: ' + err.message })
    }
})

// for browser
app.get('/updateProfileData', jwtVerify, async (req, res) => {
    try {
        const user = await Users.findById(req.session.user.userId).select('-password')
        if (!user) {
            res.status(404).send('User not found!')
        }
        res.render('updateProfileData', { user: user })
    } catch (error) {
        console.log('An error occurred: ' + error);
        res.status(500).send('Server error: ' + error)
    }
})

// update the profile data
app.post('/updateProfileData', jwtVerify, async (req, res) => {
    try {
        const { username, email, gender, password } = req.body

        // build update object
        const updatedData = {}
        if (username) updatedData.username = username
        if (email) updatedData.email = email
        if (gender) updatedData.gender = gender

        // if password is updating so hash it
        if (password) {
            updatedData.password = await bcryptjs.hash(password, 10)
        }

        const updatedUser = await Users.findByIdAndUpdate(req.user.id, updatedData, { new: true }).select('-password')

        if (!updatedUser) {
            return res.status(404).send('User not found');
        }

        // res.json({ status: 200, message: 'Profile updated.', user: updatedUser })
        res.status(200).render('dashboard', { message: 'Profile updated.', user: updatedUser })
    } catch (err) {
        console.log('An error occurred: ' + err);
        res.json({ status: 500, message: 'An error occurred: ' + err.message })
    }
})

// for browser
app.get('/deleteProfileData', (req, res) => {
    res.render('deleteProfileData')
})

// delete the profile data
app.post('/deleteProfileData', jwtVerify, async (req, res) => {
    try {
        const user = await Users.findByIdAndDelete(req.user.id)

        if (!user) {
            res.json({ status: 404, message: 'User not found!' })
        }

        res.status(401).render('register', { error: 'Account deleted successfully.' });

        // res.json({ message: 'Account deleted successfully.' })
    } catch (err) {
        console.log('An error occurred: ' + err);
        res.json({ message: 'An error: ' + err.message })
    }
})

// logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.log('An error occurres: ' + err);
            return res.status(500).send("Logout error.");
        }
        res.redirect('/login');
    });
});


// running server
app.listen(5000, () => {
    console.log("Server is started");
})