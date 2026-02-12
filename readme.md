# BoxChat Messenger

BoxChat is a simple, self-hosted messenger application.

## Stack

- **Backend:** Python, Flask, Socket.IO, JavaScript
- **Frontend:** HTML, CSS, JavaScript

## Credits

- **D7TUN6:** Founder, leader, full stack developer
- **Nekto:** Tester, frontend fixer
- **Toffo:** Future redesign and UI/UX designer

## Status

This project is maintained on a best-effort basis. Contributions are welcome!

## Getting Started

### Requirements

- Python 3.8 or higher

### Setup with venv

```bash
python -m venv boxchat-venv

# Activate virtual environment
# On Windows:
boxchat-venv\Scripts\activate

# On Linux/macOS:
source boxchat-venv/bin/activate

# Install dependencies and build frontend
pip install --upgrade pip
pip install -r requirements.txt
cd frontend && npm install && npm run build

# Run migrations
cd ..
python tools/migration.py

# Start the server
python run.py
```

### Setup with Nix

```bash
nix-shell
python tools/migration.py
python run.py
```

