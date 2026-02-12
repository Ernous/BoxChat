# User-related models

from datetime import datetime
from flask_login import UserMixin
from app.extensions import db


class Friendship(db.Model):
    __tablename__ = 'friendship'
    id = db.Column(db.Integer, primary_key=True)
    user_low_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    user_high_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.now())

    __table_args__ = (
        db.UniqueConstraint('user_low_id', 'user_high_id', name='uq_friendship_pair'),
    )


class FriendRequest(db.Model):
    __tablename__ = 'friend_request'
    id = db.Column(db.Integer, primary_key=True)
    from_user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    to_user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, default='pending')
    created_at = db.Column(db.DateTime, nullable=False, default=db.func.now())
    responded_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.Index('ix_friend_request_from_to_status', 'from_user_id', 'to_user_id', 'status'),
    )


class User(UserMixin, db.Model):
    # User model with profile and privacy settings
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    
    # Profile info
    bio = db.Column(db.String(300), default="")
    #avatar_url = db.Column(db.String(300), default="https://via.placeholder.com/50") # old placeholder avatar
    avatar_url = db.Column(db.String(300))    
    birth_date = db.Column(db.String(20))
    
    # Privacy settings
    privacy_searchable = db.Column(db.Boolean, default=True)  # Can be found in search
    privacy_listable = db.Column(db.Boolean, default=True)    # Visible in user list
    # Presence/status
    presence_status = db.Column(db.String(20), default='offline')  # 'online','offline','away','hidden'
    last_seen = db.Column(db.DateTime, nullable=True)
    hide_status = db.Column(db.Boolean, default=False)
    
    # Permissions
    is_superuser = db.Column(db.Boolean, default=False)
    
    # Ban management
    is_banned = db.Column(db.Boolean, default=False)  # Global ban status
    banned_ips = db.Column(db.Text, default="")  # Comma-separated list of banned IPs
    ban_reason = db.Column(db.String(500), nullable=True)
    banned_at = db.Column(db.DateTime, nullable=True)

    # Authentication hardening
    failed_login_attempts = db.Column(db.Integer, default=0, nullable=False)
    lockout_until = db.Column(db.DateTime, nullable=True)
    last_login_at = db.Column(db.DateTime, nullable=True)
    last_login_ip = db.Column(db.String(64), nullable=True)
    
    # Relationships
    music_tracks = db.relationship('UserMusic', backref='user', lazy=True, cascade='all, delete-orphan')
    memberships = db.relationship('Member', backref='user', lazy=True)


class AuthThrottle(db.Model):
    # Tracks auth failures by client IP for lockout protection
    id = db.Column(db.Integer, primary_key=True)
    ip_address = db.Column(db.String(64), unique=True, nullable=False, index=True)
    failed_attempts = db.Column(db.Integer, default=0, nullable=False)
    lockout_until = db.Column(db.DateTime, nullable=True)
    last_attempt_at = db.Column(db.DateTime, nullable=True)

class UserMusic(db.Model):
    # User's music library
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    artist = db.Column(db.String(200), nullable=True)
    file_url = db.Column(db.String(500), nullable=False)
    cover_url = db.Column(db.String(500), nullable=True)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
