# Fantasy Basketball Web App

1. **Frontend**: Built with React + Vite
2. **Backend**: Built with Python + Django REST Framework

---

## Prerequisites

- Python 3.10+
- pip
- Django 6.0+
- djangorestframework 3.16+

---

## Running entire app (assuming prerequisities are accounted)

- Run the following command in terminal for first time

```bash
.\start-app.ps1 
```

- Creates .venv if missing.
    1. Installs backend requirements from backend/requirements.txt
    2. Installs frontend packages if frontend/node_modules is missing
    3. Runs Django migrations
    4. Starts backend and frontend
    5. Opens browser and prints clickable URLs

- Run anytime thereafter

```bash
.\start-app.ps1 -SkipInstall
```

- If browser does not open, use these links to access web app
1. http://localhost:5173 (frontend)
2. http://127.0.0.1:8000 (backend)