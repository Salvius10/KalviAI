# KalviAI — AI-Powered School LMS

KalviAI is a full-stack Learning Management System built with the MERN stack and powered by Groq (Llama 3.3 70B). It supports three roles — Teacher, Student, and Parent — with AI features built directly into the learning experience: a Socratic AI Tutor, AI-generated assessments and flashcards, a personalized weekly learning path, and progress analytics with AI insights.

Live deployment: https://kalvi-zeta.vercel.app

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 19 + Vite + Tailwind CSS + Lucide Icons   |
| Backend    | Node.js + Express 5                             |
| Database   | MongoDB Atlas (Mongoose)                        |
| AI         | Groq SDK — Llama 3.3 70B Versatile              |
| Auth       | JWT (JSON Web Tokens)                           |
| Charts     | Recharts                                        |
| State      | Zustand                                         |
| File Parse | pdf-parse, mammoth (Word docs)                  |

---

## Features

### Teacher
- Create and publish courses with PDF/video materials
- AI-generate assessments from course material
- Detect plagiarism in student submissions
- View per-student and class-wide performance analytics
- Workspace for document editing

### Student
- Enroll in courses, track material progress
- Take AI-generated assessments with instant scoring
- AI Tutor — Socratic-method conversational tutor (Llama 3.3 70B)
- AI Flashcard Generator — generates cards from course topics
- Personalized Learning Path — AI-built weekly plan based on weak topics and pending work
- Progress Analytics — charts, topic performance, and AI-generated insight
- Study Session tracker
- Workspace for notes

### Parent
- Dashboard showing linked child's enrollment, scores, and activity
- Message teacher (ParentMessage system)

---

## Project Structure

```
KalviAI/
├── client/                        # React + Vite frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/              # Login, Register
│   │   │   ├── teacher/           # Dashboard, Courses, Assessments, Performance
│   │   │   ├── student/           # Dashboard, Courses, Assessments, Performance,
│   │   │   │                      # AITutor, Flashcards, StudySessions,
│   │   │   │                      # LearningPath, ProgressAnalytics
│   │   │   ├── parent/            # Dashboard
│   │   │   └── shared/            # Workspace
│   │   ├── components/shared/     # Layout, ThemeToggle
│   │   ├── lib/                   # axios instance, utils, useAutoRefresh
│   │   └── store/                 # authStore, themeStore (Zustand)
│   └── package.json
│
└── server/                        # Express backend
    ├── controllers/               # ai, auth, analytics, course, learningPath
    ├── middleware/                # auth.middleware (protect, restrictTo)
    ├── models/                    # User, Course, Assessment, Submission,
    │                              # AITutor, FlashcardSet, LearningPath,
    │                              # StudentProgress, StudySession, ParentMessage
    ├── routes/                    # ai, auth, analytics, course, assessment,
    │                              # submission, performance, studySession,
    │                              # learningPath, parent
    ├── scripts/                   # reset-db.js
    ├── index.js
    └── package.json
```

---

## Installation & Running

### Prerequisites
- Node.js 18+
- A [MongoDB Atlas](https://cloud.mongodb.com) account (free tier works)
- A [Groq](https://console.groq.com) API key (free)

### 1. Clone the repository

```bash
git clone https://github.com/Salvius10/KalviAI.git
cd KalviAI
```

### 2. Install server dependencies

```bash
cd server
npm install
```

### 3. Install client dependencies

```bash
cd ../client
npm install
```

### 4. Create the server environment file

Create a file at `server/.env`:

```env
PORT=3000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=any_long_random_string
JWT_EXPIRES_IN=7d
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
CLIENT_ORIGINS=http://localhost:5173,http://localhost:5174
```

> Get your `MONGO_URI` from MongoDB Atlas → Connect → Drivers.
> Get your `GROQ_API_KEY` from https://console.groq.com/keys.
> Make sure to whitelist your IP in Atlas → Network Access (or use `0.0.0.0/0` for dev).

### 5. Run the servers

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
# Runs on http://localhost:3000
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# Runs on http://localhost:5173
```

Then open http://localhost:5173 in your browser.

---

## Environment Variables

| Variable         | Description                                      | Required |
|------------------|--------------------------------------------------|----------|
| `PORT`           | Express server port (default: 3000)              | Yes      |
| `MONGO_URI`      | MongoDB Atlas connection string                  | Yes      |
| `JWT_SECRET`     | Secret key for signing JWT tokens                | Yes      |
| `JWT_EXPIRES_IN` | JWT expiry duration (e.g. `7d`)                  | Yes      |
| `GROQ_API_KEY`   | Groq API key for Llama 3.3 70B                   | Yes      |
| `GROQ_MODEL`     | Groq model name (default: llama-3.3-70b-versatile) | Yes    |
| `CLIENT_ORIGINS` | Comma-separated list of allowed frontend origins | Yes      |

---

## API Routes

| Method | Route                                  | Access  | Description                        |
|--------|----------------------------------------|---------|------------------------------------|
| POST   | `/api/auth/register`                   | Public  | Register teacher or student        |
| POST   | `/api/auth/login`                      | Public  | Login and receive JWT              |
| GET    | `/api/auth/me`                         | Auth    | Get current user                   |
| POST   | `/api/auth/register-parent`            | Auth    | Register parent linked to student  |
| GET    | `/api/courses`                         | Auth    | List courses                       |
| POST   | `/api/courses`                         | Teacher | Create course                      |
| GET    | `/api/assessments`                     | Auth    | List assessments                   |
| POST   | `/api/submissions`                     | Student | Submit assessment                  |
| GET    | `/api/performance`                     | Auth    | Student performance data           |
| POST   | `/api/ai/tutor`                        | Student | Socratic AI tutor message          |
| GET    | `/api/ai/tutor/history`                | Student | Chat history                       |
| DELETE | `/api/ai/tutor/clear`                  | Student | Clear chat history                 |
| POST   | `/api/ai/generate-assessment`          | Teacher | AI-generate assessment from doc    |
| POST   | `/api/ai/flashcards`                   | Student | AI-generate flashcards             |
| POST   | `/api/ai/detect-plagiarism`            | Teacher | Plagiarism check on submission     |
| GET    | `/api/learning-path`                   | Student | Get or generate personalized path  |
| POST   | `/api/learning-path/regenerate`        | Student | Force regenerate learning path     |
| PATCH  | `/api/learning-path/goal`              | Student | Update learning goal               |
| PATCH  | `/api/learning-path/step/:id/complete` | Student | Mark a path step complete          |
| GET    | `/api/analytics/me`                    | Student | Progress analytics                 |
| GET    | `/api/analytics/ai-insight`            | Student | AI-generated performance insight   |
| GET    | `/api/study-sessions`                  | Student | List study sessions                |
| POST   | `/api/study-sessions`                  | Student | Log a study session                |
| GET    | `/api/parent`                          | Parent  | Child's data                       |

---

## Role-Based Access

| Feature                    | Teacher | Student | Parent |
|----------------------------|:-------:|:-------:|:------:|
| Create/Publish Courses     | Yes     |         |        |
| AI Assessment Generator    | Yes     |         |        |
| Plagiarism Detection       | Yes     |         |        |
| View Class Performance     | Yes     |         |        |
| Enroll in Courses          |         | Yes     |        |
| Take Assessments           |         | Yes     |        |
| AI Tutor (Socratic)        |         | Yes     |        |
| AI Flashcard Generator     |         | Yes     |        |
| Personalized Learning Path |         | Yes     |        |
| Progress Analytics + AI    |         | Yes     |        |
| Study Session Tracker      |         | Yes     |        |
| View Child's Progress      |         |         | Yes    |

---

## Available Scripts

### Server (`cd server`)

| Command           | Description                        |
|-------------------|------------------------------------|
| `npm run dev`     | Start with nodemon (auto-reload)   |
| `npm start`       | Start without nodemon              |
| `npm run reset-db`| Wipe and reseed the database       |

### Client (`cd client`)

| Command           | Description                        |
|-------------------|------------------------------------|
| `npm run dev`     | Start Vite dev server              |
| `npm run build`   | Production build to `dist/`        |
| `npm run preview` | Preview production build locally   |
| `npm run lint`    | Run ESLint                         |

---

## Built by the KalviAI Team
