# 🎓 KalviAI — AI-Powered Educational Platform

An intelligent educational platform inspired by Moodle, built with the MERN stack.
Designed for teachers and students with role-based access, AI-ready architecture,
and real-time performance analytics.

---

## 🧠 Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React.js + Vite + Tailwind CSS + shadcn/ui |
| Backend   | Node.js + Express.js                |
| Database  | MongoDB Atlas (Mongoose)            |
| Auth      | JWT (JSON Web Tokens)               |
| Charts    | Recharts                            |
| State     | Zustand                             |

---

## 📁 Project Structure
```
KalviAI/
├── package.json              ← Root (runs both servers)
├── README.md
├── server/                   ← Backend (Express + MongoDB)
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   └── auth.controller.js
│   ├── middleware/
│   │   └── auth.middleware.js
│   ├── models/
│   │   ├── User.model.js
│   │   ├── Course.model.js
│   │   ├── Assessment.model.js
│   │   ├── Submission.model.js
│   │   ├── StudySession.model.js
│   │   └── FlashcardSet.model.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── course.routes.js
│   │   ├── assessment.routes.js
│   │   ├── submission.routes.js
│   │   ├── performance.routes.js
│   │   ├── studySession.routes.js
│   │   └── ai.routes.js
│   ├── .env                  ← You must create this (see below)
│   ├── index.js
│   └── package.json
└── client/                   ← Frontend (React + Vite)
    ├── src/
    │   ├── components/
    │   │   └── shared/
    │   │       └── Layout.jsx
    │   ├── pages/
    │   │   ├── auth/
    │   │   │   ├── Login.jsx
    │   │   │   └── Register.jsx
    │   │   ├── teacher/
    │   │   │   ├── Dashboard.jsx
    │   │   │   ├── Courses.jsx
    │   │   │   ├── Assessments.jsx
    │   │   │   └── Performance.jsx
    │   │   └── student/
    │   │       ├── Dashboard.jsx
    │   │       ├── Courses.jsx
    │   │       ├── Assessments.jsx
    │   │       ├── Performance.jsx
    │   │       ├── AITutor.jsx
    │   │       ├── Flashcards.jsx
    │   │       └── StudySessions.jsx
    │   ├── store/
    │   │   └── authStore.js
    │   ├── lib/
    │   │   ├── axios.js
    │   │   └── utils.js
    │   ├── App.jsx
    │   └── main.jsx
    └── package.json
```

---

## ⚙️ Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/kalviai.git
cd kalviai
```

### 2. Install all dependencies
```bash
npm run install:all
```

This installs packages for root, server, and client all at once.

### 3. Setup environment variables

Create a `.env` file inside the `server/` folder:
```env
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d
```

> 🔑 Get your MongoDB URI from [MongoDB Atlas](https://cloud.mongodb.com)
> Make sure to whitelist your IP in Atlas → Network Access

### 4. Run the project
```bash
npm run dev
```

This starts both servers simultaneously:
- 🟢 Backend → http://localhost:5000
- 🟢 Frontend → http://localhost:5173

---

## 📦 Dependencies

### Backend (`server/package.json`)

| Package      | Purpose                        |
|--------------|--------------------------------|
| express      | Web framework                  |
| mongoose     | MongoDB ODM                    |
| bcryptjs     | Password hashing               |
| jsonwebtoken | JWT authentication             |
| dotenv       | Environment variables          |
| cors         | Cross-origin requests          |
| multer       | File uploads                   |
| zod          | Input validation               |
| nodemon      | Auto-restart on file change    |

### Frontend (`client/package.json`)

| Package          | Purpose                        |
|------------------|--------------------------------|
| react            | UI framework                   |
| react-router-dom | Client-side routing            |
| axios            | HTTP requests                  |
| zustand          | Global state management        |
| recharts         | Charts and analytics           |
| tailwindcss      | Utility-first CSS              |
| shadcn/ui        | UI component library           |
| clsx             | Conditional classnames         |
| tailwind-merge   | Tailwind class merging         |

---

## 👥 Role-Based Access

| Feature                  | Teacher | Student |
|--------------------------|---------|---------|
| Create/Edit Courses      | ✅      | ❌      |
| Publish Courses          | ✅      | ❌      |
| Create Assessments       | ✅      | ❌      |
| View Student Performance | ✅      | ❌      |
| Plagiarism Notifications | ✅      | ❌      |
| Enroll in Courses        | ❌      | ✅      |
| Take Assessments         | ❌      | ✅      |
| View Own Performance     | ❌      | ✅      |
| AI Tutor                 | ❌      | ✅      |
| Flashcard Generator      | ❌      | ✅      |
| Study Session Tracker    | ❌      | ✅      |

---

## 🤖 AI Integration (Coming Soon)

The following features are scaffolded and ready for AI integration:

| Feature               | Location                              | Status          |
|-----------------------|---------------------------------------|-----------------|
| Assessment Generator  | `server/routes/ai.routes.js`          | ⚠️ Placeholder  |
| AI Tutor (Socratic)   | `src/pages/student/AITutor.jsx`       | ⚠️ Placeholder  |
| Flashcard Generator   | `src/pages/student/Flashcards.jsx`    | ⚠️ Placeholder  |
| Plagiarism Detector   | `server/routes/submission.routes.js`  | ⚠️ Placeholder  |

To integrate AI, add your API key to `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 🔐 Environment Variables Reference

| Variable       | Description                     | Required |
|----------------|---------------------------------|----------|
| PORT           | Server port (default: 5000)     | ✅       |
| MONGO_URI      | MongoDB Atlas connection string | ✅       |
| JWT_SECRET     | Secret key for JWT tokens       | ✅       |
| JWT_EXPIRES_IN | JWT expiry (e.g. 7d)            | ✅       |
| GEMINI_API_KEY | Google Gemini API key           | ⚠️ For AI |

---

## 🚀 Available Scripts

| Command               | Description                          |
|-----------------------|--------------------------------------|
| `npm run dev`         | Run both frontend + backend          |
| `npm run server`      | Run backend only                     |
| `npm run client`      | Run frontend only                    |
| `npm run install:all` | Install all dependencies at once     |

---

## 🛠️ Built With ❤️ by KalviAI Team

npm run install:all
# create .env in server/
npm run dev