# BoxChat messenger

BoxChat is simple messenger coded in four days.

It uses following stack:
    backend: python, flask, socket.io, js
    frontend: html, css, js

## Launching your own instance

For launching you need python 3.8+ and node.js (for socket.io)

venv:

```bash
python -m venv boxchat-venv

# Windows
boxchat-venv\Scripts\activate

# Linux/macOS
source boxchat-venv/bin/activate

# Installing dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Install NPM packages
npm install

# Run server
python run.py

```

nix:

```bash
# Activate shell
nix-shell

# Run server
python run.py
```