# CampusRent

**Student Item Rental Platform** — COMP 231 Team 1, Centennial College

CampusRent is a web-based rental coordination platform for verified college and university students. Students can list items, browse and search listings, submit rental requests, message each other, leave reviews, and report issues. Administrators verify accounts and moderate the platform.

Built according to the TAC Technical Report v5.0 specifications.

## Technology Stack

| Layer | Technology |
|--------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB Atlas with Mongoose |
| Authentication | JWT (JSON Web Token) |
| API | RESTful API |

## Features (Release 1.0)

### Guest Users
- Browse and search limited listing previews (US-01)
- View basic item information (US-02)
- Register with institutional email (US-03)

### Registered Students (verified)
- Create, edit, remove listings and update availability (US-04–07)
- Browse, search, filter, and view item details (US-08–10)
- Submit, track, approve/decline rental requests (US-11–15)
- Messaging between students (US-16–18)
- Ratings and reviews after completed rentals (US-19)
- Report users/listings (US-20)
- Manage profile (US-21)

### System Administration
- Verify student accounts (US-22)
- Moderate reports (US-23)
- Platform activity dashboard (US-24)

## Quick Start

### Prerequisites
- Node.js 18+

### Install and Run

```bash
npm install
npm run install:all
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001/api

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@mycentennialcollege.ca | admin123 |
| Student | maria@mycentennialcollege.ca | student123 |
| Student | john@mycentennialcollege.ca | student123 |

New student registrations require admin approval before accessing rental features.


## Project Structure

```
CampusRent/
│
├── backend/
│   ├── src/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── controllers/
│   │   ├── config/
│   │   └── index.ts
│   ├── uploads/
│   └── package.json
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
└── README.md
```

## Installation

### Prerequisites

- Node.js 18+
- npm
- MongoDB Atlas account

---

## Clone the Repository

```bash
git clone https://github.com/COMP231-Group1-CampusRent/CampusRent.git
cd CampusRent
```

## Team

Brian Bernales · Eden Mendez · Luiz Figueiredo · Megha Patel · Saniyabanu Ansari
