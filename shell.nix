{pkgs ? import <nixpkgs> {}}:
pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs
    (pkgs.python3.withPackages (python-pkgs: [
      python-pkgs.flask
      python-pkgs.flask-socketio
      python-pkgs.flask-sqlalchemy
      python-pkgs.flask-login
      python-pkgs.eventlet
      python-pkgs.pillow
      python-pkgs.gunicorn
      python-pkgs.python-socketio
      python-pkgs.python-engineio
      python-pkgs.python-dotenv
      python-pkgs.giphy-client
    ]))
  ];

  shellHook = ''
    echo "Flask development environment loaded!"
    echo "Libraries: Flask, SocketIO (eventlet), SQLAlchemy, Login, Pillow, gunicorn, python-socketio, python-engineio, python-dotenv, giphy-client."
    echo "NodeJS & npm are available: you can run 'npm install' to add client-side packages."
  '';
}
