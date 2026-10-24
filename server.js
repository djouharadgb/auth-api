const bcrypt = require("bcryptjs");
// Load the secrets from the .env file

require("dotenv").config();

const express = require("express");
const db = require("./database");

const app = express();
const jwt = require("jsonwebtoken");
const PORT = process.env.PORT || 3000;

// Stop the server if the secret is missing, because tokens can't be signed safely without it
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing in the .env file");
  process.exit(1);
}

// A fake hash used when the email doesn't exist (explained below)
const fakeHash = bcrypt.hashSync("not-a-real-password", 10);

// This lets the server read JSON sent in the request body
app.use(express.json());

// A test route
app.get("/", function (req, res) {
  res.json({ message: "API is working" });
});

//signup part

app.post("/signup", async function (req, res) {
  try {
    // get the data the user sent
    const body = req.body || {};
    const email = body.email;
    const password = body.password;

    // check that both fields exist and are text
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // clean the email: remove spaces and use lowercase
    const cleanEmail = email.trim().toLowerCase();

    // check the email format (something@something.something)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(cleanEmail)) {
      return res.status(400).json({ error: "Please enter a valid email" });
    }

    // check the password length
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (password.length > 72) {
      return res.status(400).json({ error: "Password must be at most 72 characters" });
    }

    // check that the email isn't already used
    const existingUser = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(cleanEmail);

    if (existingUser) {
      return res.status(409).json({ error: "This email is already registered" });
    }

    // hash the password (10 = how slow/strong the hashing is)
    const passwordHash = await bcrypt.hash(password, 10);

    // save the user in the database
    const result = db
      .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
      .run(cleanEmail, passwordHash);

    // send back a success message (never send the hash!)
    res.status(201).json({
      message: "Account created",
      user: { id: result.lastInsertRowid, email: cleanEmail },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong on the server" });
  }
});

//login part

app.post("/login", async function (req, res) {
  try {
    // get the data the user sent
    const body = req.body || {};
    const email = body.email;
    const password = body.password;

    // check that both fields exist and are text
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // clean the email the same way as in signup
    const cleanEmail = email.trim().toLowerCase();

    // look for the user in the database
    const user = db
      .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
      .get(cleanEmail);

    // compare the typed password with the stored hash.
    //    If the user doesn't exist we still compare with the fake hash,
    //    so the response takes the same time in both cases.
    const hashToCheck = user ? user.password_hash : fakeHash;
    const passwordIsCorrect = await bcrypt.compare(password, hashToCheck);

    // same vague error for "no such email" and "wrong password"
    if (!user || !passwordIsCorrect) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // create the token (the "wristband")
    const token = jwt.sign(
      { id: user.id, email: user.email },  // the payload 
      process.env.JWT_SECRET,              // the secret key that signs it
      { expiresIn: "1h" }                  // the token stops working after 1 hour
    );

    // send the token back
    res.json({
      message: "Logged in",
      token: token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong on the server" });
  }
});

//MIDDLEWARE: check the token

function verifyToken(req, res, next) {
  // read the Authorization header. It should look like: "Bearer <token>"
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  // take only the token part (remove "Bearer ")
  const token = header.slice(7);

  try {
    // check the signature and the expiry date.
    //    If anything is wrong, jwt.verify throws an error.
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    // save the user info on the request so the route can use it
    req.user = payload;

    // let the request continue to the route
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired, please log in again" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

// protected route: only accessible with a valid token

app.get("/profile", verifyToken, function (req, res) {
  // Get fresh data from the database (never select the hash)
  const user = db
    .prepare("SELECT id, email, created_at FROM users WHERE id = ?")
    .get(req.user.id);

  // The token is valid, but the user could have been deleted since then
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ user: user });
});

// start the server
app.listen(PORT, function () {
  console.log("Server running on http://localhost:" + PORT);
});