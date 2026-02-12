from __future__ import annotations

import os
from flask import Blueprint, current_app, send_from_directory

spa_bp = Blueprint('spa', __name__)


def _dist_dir() -> str:
    dist_dir = current_app.config.get('FRONTEND_DIST_DIR')
    if dist_dir:
        return dist_dir
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(root_dir, 'frontend', 'dist')


def send_spa_index():
    dist_dir = _dist_dir()
    return send_from_directory(dist_dir, 'index.html')


@spa_bp.route('/', defaults={'path': ''}, methods=['GET'])
@spa_bp.route('/<path:path>', methods=['GET'])
def serve_spa(path: str):
    dist_dir = _dist_dir()

    candidate = os.path.join(dist_dir, path)
    if path and os.path.isfile(candidate):
        return send_from_directory(dist_dir, path)

    return send_spa_index()
