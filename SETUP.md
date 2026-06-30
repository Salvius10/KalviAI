# KalviAI — Setup & Running Guide

---

## Requirements

### System Requirements

| Requirement  | Version   |
|--------------|-----------|
| Node.js      | 18 or higher |
| npm          | 8 or higher  |
| Git          | Any recent version |

### External Services

| Service       | Purpose                          | Sign-up Link                          |
|---------------|----------------------------------|---------------------------------------|
| MongoDB Atlas | Cloud database (free tier works) | https://cloud.mongodb.com             |
| Groq          | AI model API (free tier works)   | https://console.groq.com             |

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/Salvius10/KalviAI.git
cd KalviAI
```

---

## Step 2 — Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

---

## Step 3 — Set Up MongoDB Atlas

1. Go to https://cloud.mongodb.com and create a free account.
2. Create a new **Project** and a free **M0 cluster**.
3. Under **Database Access**, create a database user with read/write permissions.
4. Under **Network Access**, add your IP address (or `0.0.0.0/0` to allow all IPs during development).
5. Go to your cluster → **Connect** → **Drivers** → copy the connection string.

The connection string looks like:
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority
```

Replace `<username>`, `<password>`, and `<dbname>` with your actual values.

---

## Step 4 — Get a Groq API Key

1. Go to https://console.groq.com and sign in.
2. Navigate to **API Keys** → **Create API Key**.
3. Copy the key — you will add it to the server `.env` file.

---

## Step 5 — Create Environment Files

### Server — `server/.env`

Create a file named `.env` inside the `server/` directory:

```env
PORT=3000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=any_long_random_string_at_least_32_chars
JWT_EXPIRES_IN=7d
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
CLIENT_ORIGINS=http://localhost:5173,http://localhost:5174
```

### Client — `client/.env`

Create a file named `.env` inside the `client/` directory:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

---

## Step 6 — Run the Project

You need **two terminals** running simultaneously.

### Terminal 1 — Start the Backend

```bash
cd server
npm run dev
```

Expected output:
```
Server running on port 3000
MongoDB connected
```

### Terminal 2 — Start the Frontend

```bash
cd client
npm run dev
```

Expected output:
```
  VITE ready in Xms

  ➜  Local:   http://localhost:5173/
```

---

## Step 7 — Open in Browser

Navigate to **http://localhost:5173**

Register a new account and choose your role:
- **Teacher** — create courses and AI-generate assessments
- **Student** — enroll, use AI tutor, get a personalized learning path
- **Parent** — link to an existing student account by their email

---

## Available Scripts

### Server (`cd server`)

| Command              | Description                             |
|----------------------|-----------------------------------------|
| `npm run dev`        | Start server with auto-reload (nodemon) |
| `npm start`          | Start server without auto-reload        |
| `npm run reset-db`   | Wipe and reseed the database            |

### Client (`cd client`)

| Command              | Description                             |
|----------------------|-----------------------------------------|
| `npm run dev`        | Start Vite dev server on :5173          |
| `npm run build`      | Build for production (outputs to dist/) |
| `npm run preview`    | Preview the production build locally    |
| `npm run lint`       | Run ESLint checks                       |

---

## Environment Variable Reference

### Server (`server/.env`)

| Variable          | Description                                        | Required |
|-------------------|----------------------------------------------------|----------|
| `PORT`            | Port the Express server listens on                 | Yes      |
| `MONGO_URI`       | MongoDB Atlas connection string                    | Yes      |
| `JWT_SECRET`      | Secret used to sign JWT tokens                     | Yes      |
| `JWT_EXPIRES_IN`  | How long tokens stay valid (e.g. `7d`, `24h`)      | Yes      |
| `GROQ_API_KEY`    | API key for the Groq AI service                    | Yes      |
| `GROQ_MODEL`      | Groq model ID (default: `llama-3.3-70b-versatile`) | Yes      |
| `CLIENT_ORIGINS`  | Comma-separated allowed CORS origins               | Yes      |

### Client (`client/.env`)

| Variable             | Description                              | Required |
|----------------------|------------------------------------------|----------|
| `VITE_API_BASE_URL`  | Full URL of the backend API              | Yes      |

---

## Troubleshooting

**`MongooseServerSelectionError` / can't connect to MongoDB**
- Check your `MONGO_URI` in `server/.env`.
- Make sure your IP is whitelisted in MongoDB Atlas → Network Access.
- Verify the database user credentials in the connection string.

**`401 Unauthorized` on API calls**
- Make sure `JWT_SECRET` is set and not empty.
- Clear browser local storage and log in again.

**Groq API errors**
- Confirm `GROQ_API_KEY` is correct and has not expired.
- Verify `GROQ_MODEL` is set to `llama-3.3-70b-versatile`.

**Frontend can't reach backend**
- Check `VITE_API_BASE_URL` in `client/.env` matches the server port.
- Make sure the backend server is running before using the frontend.
- Restart the Vite dev server after editing `.env` files.

**Port already in use**
- Change `PORT` in `server/.env` to a free port (e.g. `3001`).
- Update `VITE_API_BASE_URL` in `client/.env` to match.
