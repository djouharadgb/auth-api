# Auth API

A small REST API with signup, login, password hashing and JWT authentication.

Built with Node.js, Express, SQLite, bcryptjs and jsonwebtoken.

## Setup

1. Install Node.js (LTS version).
2. Install the libraries:
   ```
   npm install
   ```
3. Create a `.env` file in the project root:
   ```
   PORT=3000
   JWT_SECRET=put_a_long_random_text_here
   ```
   You can generate a secret with:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Start the server:
   ```
   npm start
   ```
   Or, to restart automatically on every change:
   ```
   npm run dev
   ```

The server runs on `http://localhost:3000`. The database file `users.db` is created automatically the first time.

## Endpoints

| Method | Route | Protected | Description |
|---|---|---|---|
| POST | `/signup` | No | Create an account |
| POST | `/login` | No | Log in and get a JWT |
| GET | `/profile` | Yes | Get the logged-in user |

### POST /signup

Body:
```json
{ "email": "test@mail.com", "password": "mypassword123" }
```

Response `201`:
```json
{ "message": "Account created", "user": { "id": 1, "email": "test@mail.com" } }
```

Errors: `400` missing or invalid input, `409` email already registered.

### POST /login

Body:
```json
{ "email": "test@mail.com", "password": "mypassword123" }
```

Response `200`:
```json
{ "message": "Logged in", "token": "eyJhbGciOi..." }
```

Errors: `400` missing input, `401` invalid email or password.

### GET /profile

Send the token in the header:
```
Authorization: Bearer <your token>
```

Response `200`:
```json
{ "user": { "id": 1, "email": "test@mail.com", "created_at": "2026-10-24 12:00:00" } }
```

Errors: `401` missing, invalid or expired token.

## Validation rules

- Email must have a valid format. It is trimmed and converted to lowercase.
- Password must be between 8 and 72 characters.

## Security

- Passwords are hashed with bcrypt (10 rounds) and are never stored or returned in plain text.
- JWTs are signed with a secret from the `.env` file and expire after 1 hour.
- Only the HS256 algorithm is accepted when verifying tokens.
- Login returns the same error for a wrong email and a wrong password, and takes about the same time in both cases.
- SQL queries use placeholders, which protects against SQL injection.
- The `.env` file and the database are listed in `.gitignore`.

## Project files

| File | Role |
|---|---|
| `server.js` | Routes, middleware and server start |
| `database.js` | SQLite connection and `users` table |
| `.env` | Secrets (not uploaded to Git) |
| `.gitignore` | Files that Git should ignore |

## How to test

Use Thunder Client (VS Code), Postman or curl.

1. `POST /signup` with an email and password.
2. `POST /login` with the same email and password, then copy the token.
3. `GET /profile` with the header `Authorization: Bearer <token>`.
4. Try it without a token, or with a changed token, and you should get `401`.