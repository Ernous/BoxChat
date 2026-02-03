{
  config,
  pkgs,
  ...
}: let
  pythonEnv = pkgs.python3.withPackages (ps:
    with ps; [
      flask
      flask-socketio
      flask-sqlalchemy
      flask-login
      eventlet
      pillow
      werkzeug
    ]);
in {
  # Мы юзаем для развёртывания божественный nixos, так что додумывай сам если что если ты не "из этих"
  systemd.services.thecomboxmsgr = {
    description = "TheComBoxMSGR Flask Application";
    wantedBy = ["multi-user.target"];
    after = ["network.target"];

    serviceConfig = {
      Type = "simple";
      User = "d7tun6"; # Замени на твоего пользователя откуда ты запускаешь это всё, тут мой ник
      Group = "users";
      WorkingDirectory = "/home/d7tun6/msgr";
      ExecStart = "${pythonEnv}/bin/python /home/d7tun6/msgr/app.py";
      Restart = "always";
      RestartSec = 10;
      StandardOutput = "journal";
      StandardError = "journal";

      # Может ломать пиздец иногда
      PrivateTmp = true;
      ProtectSystem = "strict";
      ProtectHome = "read-only";
      ReadWritePaths = ["/home/d7tun6/msgr"];
    };

    environment = {
      PYTHONUNBUFFERED = "1";
      FLASK_APP = "app.py";
    };
  };

  # Nginx прокси ибо порт не 443 ибо у меня на хосте ещё два вебсервера
  services.nginx = {
    enable = true;

    virtualHosts."msgr.thecombox.site" = {
      serverName = "msgr.thecombox.site";
      locations."/" = {
        proxyPass = "http://127.0.0.1:5000";
        proxyWebsockets = true;
        extraConfig = ''
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_connect_timeout 60s;
          proxy_send_timeout 60s;
          proxy_read_timeout 60s;
        '';
      };

      locations."/uploads/" = {
        proxyPass = "http://127.0.0.1:5000";
        extraConfig = ''
          proxy_set_header Host $host;
        '';
      };

      locations."/socket.io/" = {
        proxyPass = "http://127.0.0.1:5000";
        proxyWebsockets = true;
        extraConfig = ''
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_connect_timeout 7d;
          proxy_send_timeout 7d;
          proxy_read_timeout 7d;
        '';
      };
    };
  };
}
