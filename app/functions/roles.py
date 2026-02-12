import re
from app.extensions import db
from app.models import Role, MemberRole, RoleMentionPermission, Member


ROLE_TAG_RE = re.compile(r'[^a-zA-Z0-9_-]+')


def normalize_role_tag(name: str) -> str:
    value = (name or '').strip().lower()
    value = value.replace(' ', '_')
    value = ROLE_TAG_RE.sub('', value)
    return value[:60]


def ensure_default_roles(room_id: int):
    everyone = Role.query.filter_by(room_id=room_id, mention_tag='everyone').first()
    if not everyone:
        everyone = Role(
            room_id=room_id,
            name='everyone',
            mention_tag='everyone',
            is_system=True,
            can_be_mentioned_by_everyone=False
        )
        db.session.add(everyone)
        db.session.flush()

    admin = Role.query.filter_by(room_id=room_id, mention_tag='admin').first()
    if not admin:
        admin = Role(
            room_id=room_id,
            name='admin',
            mention_tag='admin',
            is_system=True,
            can_be_mentioned_by_everyone=False
        )
        db.session.add(admin)
        db.session.flush()

    return everyone, admin


def _ensure_member_role_link(user_id: int, room_id: int, role_id: int):
    exists = MemberRole.query.filter_by(user_id=user_id, room_id=room_id, role_id=role_id).first()
    if not exists:
        db.session.add(MemberRole(user_id=user_id, room_id=room_id, role_id=role_id))


def ensure_user_default_roles(user_id: int, room_id: int):
    member = Member.query.filter_by(user_id=user_id, room_id=room_id).first()
    if not member:
        return

    everyone, admin = ensure_default_roles(room_id)
    _ensure_member_role_link(user_id, room_id, everyone.id)

    if member.role in ('owner', 'admin'):
        _ensure_member_role_link(user_id, room_id, admin.id)


def seed_roles_for_existing_rooms():
    members = Member.query.all()
    seen_room_ids = set()
    for m in members:
        if m.room_id not in seen_room_ids:
            ensure_default_roles(m.room_id)
            seen_room_ids.add(m.room_id)
        ensure_user_default_roles(m.user_id, m.room_id)
    db.session.commit()


def get_user_role_ids(user_id: int, room_id: int):
    links = MemberRole.query.filter_by(user_id=user_id, room_id=room_id).all()
    return {link.role_id for link in links}


def can_user_mention_role(user_id: int, room_id: int, target_role: Role):
    member = Member.query.filter_by(user_id=user_id, room_id=room_id).first()
    if not member:
        return False

    # Owners/admins can mention any role
    if member.role in ('owner', 'admin'):
        return True

    if target_role.can_be_mentioned_by_everyone:
        return True

    user_role_ids = get_user_role_ids(user_id, room_id)
    if not user_role_ids:
        return False

    permission = RoleMentionPermission.query.filter(
        RoleMentionPermission.room_id == room_id,
        RoleMentionPermission.target_role_id == target_role.id,
        RoleMentionPermission.source_role_id.in_(list(user_role_ids))
    ).first()
    return permission is not None
