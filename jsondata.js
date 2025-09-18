const fs = require("fs");
const path = require("path");
const { body, validationResult } = require("express-validator");
const bcryptjs = require("bcryptjs");

// JSON file path
const usersFilePath = path.join(__dirname, "users.json");

// helper function to read users
function readUsers() {
    if (!fs.existsSync(usersFilePath)) {
        return [];
    }
    const data = fs.readFileSync(usersFilePath);
    return JSON.parse(data);
}

// helper function to write users
function writeUsers(users) {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
}

// REGISTER (Save in JSON instead of MongoDB)
app.post(
    "/register",
    uploads.fields([
        { name: "profilePic", maxCount: 1 },
        { name: "documents", maxCount: 3 },
    ]),

    [
        body("username").notEmpty().withMessage("Username is required"),
        body("email").isEmail().withMessage("Enter a valid email"),
        body("password")
            .isLength({ min: 6 })
            .withMessage("Password must be at least 6 characters long"),
        body("gender").notEmpty().withMessage("Gender is required"),
    ],

    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render("register", {
                errors: errors.array(),
                oldInput: req.body,
            });
        }

        try {
            const users = readUsers();

            // check if email already exists
            const existingUser = users.find((u) => u.email === req.body.email);
            if (existingUser) {
                return res.render("register", {
                    errors: [{ msg: "Email already registered" }],
                    oldInput: req.body,
                });
            }

            const hashPassword = await bcryptjs.hash(req.body.password, 10);

            const newUser = {
                id: Date.now(), // unique id
                username: req.body.username,
                email: req.body.email,
                gender: req.body.gender,
                password: hashPassword,
                profilePic: req.files["profilePic"]
                    ? req.files["profilePic"][0].filename
                    : null,
                documents: req.files["documents"]
                    ? req.files["documents"].map((file) => file.filename)
                    : [],
            };

            users.push(newUser);
            writeUsers(users);

            res.render("success", { user: newUser });
        } catch (err) {
            console.log("An error occurred: " + err);
            res.status(500).json({ error: err.message });
        }
    }
);

app.post("/login", async (req, res) => {
    try {
        const users = readUsers();
        const { email, username, password } = req.body;

        const user = users.find(
            (u) => u.email === email || u.username === username
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isMatch = await bcryptjs.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid password" });
        }

        res.render("success", { user }); // show user dashboard
    } catch (err) {
        console.log("An error occurred: " + err);
        res.status(500).json({ error: err.message });
    }
});

// Read users
function readUsers() {
    if (!fs.existsSync(usersFilePath)) {
        return [];
    }
    const data = fs.readFileSync(usersFilePath);
    return JSON.parse(data);
}

// Write users
function writeUsers(users) {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
}

// GET user by email
app.get("/user/email/:email", (req, res) => {
    const users = readUsers();
    const user = users.find((u) => u.email === req.params.email);

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
});

// GET user by id
app.get("/user/:id", (req, res) => {
    const users = readUsers();
    const user = users.find((u) => u.id == req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
});

app.put("/user/:id", (req, res) => {
    let users = readUsers();
    const userIndex = users.findIndex((u) => u.id == req.params.id);

    if (userIndex === -1) {
        return res.status(404).json({ message: "User not found" });
    }

    // update allowed fields
    users[userIndex].username = req.body.username || users[userIndex].username;
    users[userIndex].email = req.body.email || users[userIndex].email;
    users[userIndex].gender = req.body.gender || users[userIndex].gender;

    writeUsers(users);

    res.json({ message: "User updated successfully", user: users[userIndex] });
});

app.delete("/user/:id", (req, res) => {
    let users = readUsers();
    const newUsers = users.filter((u) => u.id != req.params.id);

    if (newUsers.length === users.length) {
        return res.status(404).json({ message: "User not found" });
    }

    writeUsers(newUsers);
    res.json({ message: "User deleted successfully" });
});

