from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_from_directory
from flask_socketio import SocketIO, join_room, leave_room, send, emit
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin, login_user, LoginManager, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime
import os
import uuid
import re
from PIL import Image

app = Flask(__name__)
app.config['SECRET_KEY'] = 'super_secret_key_v2'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///thecomboxmsgr.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp3', 'ogg', 'flac', 'wav', 'txt', 'py', 'js', 'html', 'css', 'json', 'xml', 'md', 'pdf', 'zip', 'rar'}

# Создаем папки для загрузок
os.makedirs('uploads/avatars', exist_ok=True)
os.makedirs('uploads/room_avatars', exist_ok=True)
os.makedirs('uploads/channel_icons', exist_ok=True)
os.makedirs('uploads/files', exist_ok=True)
os.makedirs('uploads/music', exist_ok=True)

db = SQLAlchemy(app)
socketio = SocketIO(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# --- МОДЕЛИ БД ---

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    
    # Профиль
    bio = db.Column(db.String(300), default="")
    avatar_url = db.Column(db.String(300), default="https://via.placeholder.com/50")
    birth_date = db.Column(db.String(20))
    
    # Настройки
    privacy_searchable = db.Column(db.Boolean, default=True) # Можно ли найти в поиске
    privacy_listable = db.Column(db.Boolean, default=True)   # Видно ли в списке всех юзеров
    
    # Глобальный админ
    is_superuser = db.Column(db.Boolean, default=False)
    
    # Музыкальная библиотека
    music_tracks = db.relationship('UserMusic', backref='user', lazy=True, cascade='all, delete-orphan')

class Room(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150))
    type = db.Column(db.String(20), nullable=False) # 'dm', 'server', 'broadcast'
    is_public = db.Column(db.Boolean, default=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    avatar_url = db.Column(db.String(300), nullable=True)
    invite_token = db.Column(db.String(100), nullable=True, unique=True)  # Токен для приглашений
    
    # Для блогов: привязка группы для комментариев
    linked_chat_id = db.Column(db.Integer, db.ForeignKey('room.id'), nullable=True)
    
    channels = db.relationship('Channel', backref='room', lazy=True, cascade='all, delete-orphan')
    members = db.relationship('Member', backref='room', lazy=True)

class Member(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    room_id = db.Column(db.Integer, db.ForeignKey('room.id', ondelete='CASCADE'))
    role = db.Column(db.String(20), default='member') # 'owner', 'admin', 'member', 'banned'
    
    user = db.relationship('User', backref='memberships')

class Channel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey('room.id'))
    description = db.Column(db.String(500), nullable=True)
    icon_emoji = db.Column(db.String(10), nullable=True)
    icon_image_url = db.Column(db.String(300), nullable=True)
    messages = db.relationship('Message', backref='channel', lazy=True, cascade='all, delete-orphan')

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    edited_at = db.Column(db.DateTime, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    channel_id = db.Column(db.Integer, db.ForeignKey('channel.id'))
    message_type = db.Column(db.String(20), default='text')  # 'text', 'image', 'file', 'music', 'sticker'
    file_url = db.Column(db.String(500), nullable=True)
    file_name = db.Column(db.String(200), nullable=True)
    file_size = db.Column(db.Integer, nullable=True)
    
    user = db.relationship('User')
    reactions = db.relationship('MessageReaction', backref='message', lazy=True, cascade='all, delete-orphan')

class MessageReaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('message.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    emoji = db.Column(db.String(50), nullable=False)  # Эмодзи или ID стикера
    reaction_type = db.Column(db.String(20), default='emoji')  # 'emoji' или 'sticker'
    
    user = db.relationship('User')

class ReadMessage(db.Model):
    """Отслеживание прочитанных сообщений пользователем в канале"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    channel_id = db.Column(db.Integer, db.ForeignKey('channel.id'), nullable=False)
    last_read_message_id = db.Column(db.Integer, db.ForeignKey('message.id'), nullable=True)
    last_read_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User')
    channel = db.relationship('Channel')

class StickerPack(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    icon_emoji = db.Column(db.String(10), nullable=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    owner = db.relationship('User')
    stickers = db.relationship('Sticker', backref='pack', lazy=True, cascade='all, delete-orphan')

class Sticker(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    file_url = db.Column(db.String(500), nullable=False)
    pack_id = db.Column(db.Integer, db.ForeignKey('sticker_pack.id'), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    owner = db.relationship('User')

class UserMusic(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    artist = db.Column(db.String(200), nullable=True)
    file_url = db.Column(db.String(500), nullable=False)
    cover_url = db.Column(db.String(500), nullable=True)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

with app.app_context():
    # Создаем все таблицы, если их нет
    # Проверяем существование файла БД
    db_file = 'thecomboxmsgr.db'
    db_exists = os.path.exists(db_file)
    
    try:
        if not db_exists:
            print("База данных не найдена, создаем новую...")
        db.create_all()
        if not db_exists:
            print("База данных успешно создана!")
    except Exception as e:
        print(f"Ошибка при создании таблиц БД: {e}")
        # Если не получилось, пробуем пересоздать
        try:
            if db_exists:
                print("Пробуем пересоздать базу данных...")
            db.drop_all()
            db.create_all()
            print("База данных пересоздана!")
        except Exception as e2:
            print(f"Критическая ошибка при создании БД: {e2}")
            import traceback
            traceback.print_exc()
    
    # Обновляем схему базы данных
    try:
        # Проверяем существование новых колонок и таблиц
        from sqlalchemy import inspect, text
        
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        # Обновляем таблицу message
        if 'message' in tables:
            columns = [col['name'] for col in inspector.get_columns('message')]
            if 'edited_at' not in columns:
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text('ALTER TABLE message ADD COLUMN edited_at DATETIME'))
                        conn.commit()
                except:
                    pass
        
        # Создаем новые таблицы если их нет
        if 'message_reaction' not in tables:
            try:
                MessageReaction.__table__.create(db.engine)
            except:
                pass
        
        if 'read_message' not in tables:
            try:
                ReadMessage.__table__.create(db.engine)
            except:
                pass
        
        if 'sticker_pack' not in tables:
            try:
                StickerPack.__table__.create(db.engine)
            except:
                pass
        
        if 'sticker' not in tables:
            try:
                Sticker.__table__.create(db.engine)
            except:
                pass
        
        # Добавляем колонку invite_token если её нет
        if 'room' in tables:
            columns = [col['name'] for col in inspector.get_columns('room')]
            if 'invite_token' not in columns:
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text('ALTER TABLE room ADD COLUMN invite_token VARCHAR(100)'))
                        conn.commit()
                except:
                    pass
    except Exception as e:
        print(f"Ошибка при обновлении схемы БД: {e}")
        # Если не получилось обновить, пересоздаем все таблицы
        try:
            db.drop_all()
            db.create_all()
        except Exception as e2:
            print(f"Критическая ошибка при пересоздании БД: {e2}")
    
    # Создаем супер-админа, если нет
    try:
        if not User.query.filter_by(username='admin').first():
            admin = User(username='admin', password=generate_password_hash('admin', method='scrypt'), is_superuser=True)
            db.session.add(admin)
            db.session.commit()
    except Exception as e:
        print(f"Ошибка при создании админа: {e}")

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
def get_role(user_id, room_id):
    member = Member.query.filter_by(user_id=user_id, room_id=room_id).first()
    return member.role if member else None

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def is_image_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def is_music_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'mp3', 'ogg', 'flac', 'wav'}

def save_uploaded_file(file, subfolder='files'):
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], subfolder, unique_filename)
        file.save(filepath)
        # Для стикеров делаем квадратную миниатюру
        if subfolder == 'stickers' and is_image_file(file.filename):
            try:
                img = Image.open(filepath)
                size = min(img.size)
                img = img.crop((0, 0, size, size))
                img.thumbnail((256, 256), Image.Resampling.LANCZOS)
                img.save(filepath)
            except:
                pass
        return f"/uploads/{subfolder}/{unique_filename}"
    return None

def resize_image(filepath, max_size=(32, 32)):
    try:
        img = Image.open(filepath)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        img.save(filepath)
    except Exception as e:
        print(f"Error resizing image: {e}")

# --- РОУТЫ ---

@app.route('/')
@login_required
def dashboard():
    # Список ЛС - получаем с информацией о собеседнике и непрочитанных сообщениях
    dms_query = db.session.query(Room, Member).join(Member).filter(
        Member.user_id == current_user.id, 
        Room.type == 'dm'
    ).all()
    
    dms_with_info = []
    for room, member in dms_query:
        # Находим собеседника
        other_member = Member.query.filter(
            Member.room_id == room.id,
            Member.user_id != current_user.id
        ).first()
        other_user = other_member.user if other_member else None
        
        # Получаем канал ЛС
        channel = Channel.query.filter_by(room_id=room.id).first()
        unread_count = 0
        if channel:
            # Получаем последнее прочитанное сообщение
            read_msg = ReadMessage.query.filter_by(
                user_id=current_user.id,
                channel_id=channel.id
            ).first()
            
            if read_msg and read_msg.last_read_message_id:
                # Считаем непрочитанные сообщения после последнего прочитанного
                unread_count = Message.query.filter(
                    Message.channel_id == channel.id,
                    Message.id > read_msg.last_read_message_id,
                    Message.user_id != current_user.id
                ).count()
            elif not read_msg:
                # Если никогда не читал, считаем все сообщения от других
                unread_count = Message.query.filter(
                    Message.channel_id == channel.id,
                    Message.user_id != current_user.id
                ).count()
        
        dms_with_info.append({
            'room': room,
            'other_user': other_user,
            'unread_count': unread_count
        })
    
    # Сортируем по непрочитанным (сначала с непрочитанными) и по последнему сообщению
    dms_with_info.sort(key=lambda x: (
        x['unread_count'] == 0,  # Сначала непрочитанные
        -x['room'].id  # Потом по ID (новые сверху)
    ))
    
    # Список серверов/каналов, где состоит - с информацией о роли
    # Фильтруем только существующие комнаты
    servers_query = db.session.query(Room, Member).join(Member).filter(
        Member.user_id == current_user.id, 
        Room.type.in_(['server', 'broadcast'])
    ).all()
    
    servers_with_role = []
    for room, member in servers_query:
        if room:  # Проверяем, что комната существует
            servers_with_role.append({
                'room': room,
                'role': member.role
            })
    
    # Очищаем "висячие" Member записи, которые ссылаются на несуществующие комнаты
    # Это может произойти, если каскадное удаление не сработало
    orphaned_members = db.session.query(Member).filter(
        Member.user_id == current_user.id,
        ~Member.room_id.in_(db.session.query(Room.id))
    ).all()
    if orphaned_members:
        for orphan in orphaned_members:
            db.session.delete(orphan)
        db.session.commit()
    
    return render_template('dashboard.html', dms=dms_with_info, servers=servers_with_role, user=current_user)

@app.route('/explore')
@login_required
def explore():
    # Поиск публичных комнат и пользователей
    query = request.args.get('q', '')
    users = []
    rooms = []
    if query:
        users = User.query.filter(User.username.contains(query), User.privacy_searchable == True).all()
        rooms = Room.query.filter(Room.name.contains(query), Room.is_public == True).all()
    else:
        # Показать всех доступных
        if current_user.is_superuser: # Админ видит всех
             users = User.query.all()
        else:
             users = User.query.filter_by(privacy_listable=True).all()
        rooms = Room.query.filter_by(is_public=True).all()
        
    return render_template('explore.html', users=users, rooms=rooms, query=query)

@app.route('/create_room', methods=['POST'])
@login_required
def create_room():
    name = request.form.get('name')
    rtype = request.form.get('type') # server, broadcast
    is_public = 'is_public' in request.form
    
    new_room = Room(name=name, type=rtype, is_public=is_public, owner_id=current_user.id)
    db.session.add(new_room)
    db.session.commit()
    
    # Добавляем создателя как владельца
    mem = Member(user_id=current_user.id, room_id=new_room.id, role='owner')
    # Создаем дефолтный канал #general
    chan = Channel(name='general', room_id=new_room.id)
    
    db.session.add(mem)
    db.session.add(chan)
    db.session.commit()
    
    return redirect(url_for('view_room', room_id=new_room.id))

@app.route('/start_dm/<int:user_id>')
@login_required
def start_dm(user_id):
    other = User.query.get_or_404(user_id)
    
    # Проверяем, есть ли уже ЛС между этими двумя пользователями
    # Ищем комнаты типа 'dm', где оба пользователя являются участниками
    existing_dm = db.session.query(Room).join(Member).filter(
        Room.type == 'dm',
        Member.user_id.in_([current_user.id, other.id])
    ).group_by(Room.id).having(
        db.func.count(db.distinct(Member.user_id)) == 2
    ).first()
    
    if existing_dm:
        # ЛС уже существует, перенаправляем туда
        return redirect(url_for('view_room', room_id=existing_dm.id))
    
    # Создаем новое ЛС (название не важно, будет отображаться имя собеседника)
    room = Room(name=f"dm_{current_user.id}_{other.id}", type='dm', is_public=False)
    db.session.add(room)
    db.session.commit()
    
    m1 = Member(user_id=current_user.id, room_id=room.id, role='admin')
    m2 = Member(user_id=other.id, room_id=room.id, role='admin')
    c1 = Channel(name='main', room_id=room.id)
    
    db.session.add_all([m1, m2, c1])
    db.session.commit()
    
    # Уведомляем другого пользователя о новом ЛС через Socket.IO
    socketio.emit('new_dm_created', {
        'room_id': room.id,
        'from_user': current_user.username,
        'from_user_id': current_user.id,
        'from_avatar': current_user.avatar_url
    }, room=f"user_{other.id}")
    
    return redirect(url_for('view_room', room_id=room.id))

@app.route('/room/<int:room_id>')
@login_required
def view_room(room_id):
    room = Room.query.get_or_404(room_id)
    member = Member.query.filter_by(user_id=current_user.id, room_id=room_id).first()
    
    if not member or member.role == 'banned':
        if room.is_public and not member:
            pass # Если публичная - можно превью (или кнопку Join), но тут упростим:
        else:
            flash('Нет доступа или вы забанены')
            return redirect(url_for('dashboard'))

    # Активный канал
    active_channel_id = request.args.get('channel_id')
    if not active_channel_id and room.channels:
        active_channel_id = room.channels[0].id
    
    messages = []
    if active_channel_id:
        messages = Message.query.filter_by(channel_id=active_channel_id).order_by(Message.timestamp.asc()).all()
        # Загружаем реакции для каждого сообщения
        for msg in messages:
            msg.reactions_grouped = {}
            # Перезагружаем реакции из БД
            reactions = MessageReaction.query.filter_by(message_id=msg.id).all()
            for reaction in reactions:
                if reaction.emoji not in msg.reactions_grouped:
                    msg.reactions_grouped[reaction.emoji] = []
                msg.reactions_grouped[reaction.emoji].append(reaction.user.username)
        
        # Отмечаем все сообщения в канале как прочитанные
        if messages:
            last_message = messages[-1]
            read_msg = ReadMessage.query.filter_by(
                user_id=current_user.id,
                channel_id=active_channel_id
            ).first()
            
            if read_msg:
                read_msg.last_read_message_id = last_message.id
                read_msg.last_read_at = datetime.utcnow()
            else:
                read_msg = ReadMessage(
                    user_id=current_user.id,
                    channel_id=active_channel_id,
                    last_read_message_id=last_message.id
                )
                db.session.add(read_msg)
            db.session.commit()
            
            # Уведомляем других пользователей об обновлении прочитанных сообщений
            socketio.emit('read_status_updated', {
                'user_id': current_user.id,
                'username': current_user.username,
                'channel_id': active_channel_id
            }, room=str(active_channel_id))

    return render_template('room.html', room=room, member=member, active_channel_id=int(active_channel_id) if active_channel_id else None, messages=messages)

@app.route('/join_room/<int:room_id>')
@login_required
def join_room_view(room_id):
    room = Room.query.get_or_404(room_id)
    if room.is_public:
        if not Member.query.filter_by(user_id=current_user.id, room_id=room_id).first():
            m = Member(user_id=current_user.id, room_id=room_id, role='member')
            db.session.add(m)
            db.session.commit()
    return redirect(url_for('view_room', room_id=room_id))

# --- АДМИНСКИЕ ДЕЙСТВИЯ (API) ---

@app.route('/room/<int:room_id>/add_channel', methods=['POST'])
@login_required
def add_channel(room_id):
    role = get_role(current_user.id, room_id)
    if role in ['owner', 'admin']:
        name = request.form.get('name')
        c = Channel(name=name, room_id=room_id)
        db.session.add(c)
        db.session.commit()
    return redirect(url_for('view_room', room_id=room_id))

@app.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    if request.method == 'POST':
        current_user.bio = request.form.get('bio')
        current_user.privacy_searchable = 'privacy_searchable' in request.form
        current_user.privacy_listable = 'privacy_listable' in request.form
        
        # Загрузка аватара (только через файл, не через URL для безопасности)
        if 'avatar_file' in request.files:
            file = request.files['avatar_file']
            if file and file.filename:
                filepath = save_uploaded_file(file, 'avatars')
                if filepath:
                    current_user.avatar_url = filepath
        
        db.session.commit()
        flash('Настройки обновлены')
    return render_template('settings.html', user=current_user)

@app.route('/room/<int:room_id>/settings', methods=['GET', 'POST'])
@login_required
def room_settings(room_id):
    room = Room.query.get_or_404(room_id)
    role = get_role(current_user.id, room_id)
    if role not in ['owner', 'admin']:
        flash('Нет доступа')
        return redirect(url_for('view_room', room_id=room_id))
    
    if request.method == 'POST':
        room.name = request.form.get('name', room.name)
        if 'avatar_file' in request.files:
            file = request.files['avatar_file']
            if file and file.filename:
                filepath = save_uploaded_file(file, 'room_avatars')
                if filepath:
                    room.avatar_url = filepath
        db.session.commit()
        flash('Настройки комнаты обновлены')
        return redirect(url_for('view_room', room_id=room_id))
    
    return render_template('room_settings.html', room=room)

@app.route('/room/<int:room_id>/channel/<int:channel_id>/edit', methods=['POST'])
@login_required
def edit_channel(room_id, channel_id):
    role = get_role(current_user.id, room_id)
    if role not in ['owner', 'admin']:
        return jsonify({'error': 'Нет доступа'}), 403
    
    channel = Channel.query.get_or_404(channel_id)
    if channel.room_id != room_id:
        return jsonify({'error': 'Неверный канал'}), 400
    
    channel.name = request.form.get('name', channel.name)
    channel.description = request.form.get('description', channel.description)
    channel.icon_emoji = request.form.get('icon_emoji', channel.icon_emoji)
    
    if 'icon_file' in request.files:
        file = request.files['icon_file']
        if file and file.filename:
            filepath = save_uploaded_file(file, 'channel_icons')
            if filepath:
                # Ресайз до 32x32
                full_path = os.path.join(app.config['UPLOAD_FOLDER'], 'channel_icons', filepath.split('/')[-1])
                resize_image(full_path, (32, 32))
                channel.icon_image_url = filepath
    
    db.session.commit()
    return jsonify({'success': True})

@app.route('/room/<int:room_id>/channel/<int:channel_id>/delete', methods=['POST'])
@login_required
def delete_channel(room_id, channel_id):
    role = get_role(current_user.id, room_id)
    if role not in ['owner', 'admin']:
        return jsonify({'error': 'Нет доступа'}), 403
    
    channel = Channel.query.get_or_404(channel_id)
    if channel.room_id != room_id:
        return jsonify({'error': 'Неверный канал'}), 400
    
    db.session.delete(channel)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/upload_file', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'Нет файла'}), 400
    
    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'Файл не выбран'}), 400
    
    if is_image_file(file.filename):
        filepath = save_uploaded_file(file, 'files')
        return jsonify({'success': True, 'url': filepath, 'type': 'image'})
    elif is_music_file(file.filename):
        filepath = save_uploaded_file(file, 'music')
        return jsonify({'success': True, 'url': filepath, 'type': 'music'})
    else:
        filepath = save_uploaded_file(file, 'files')
        return jsonify({'success': True, 'url': filepath, 'type': 'file', 'filename': file.filename})

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/profile/<int:user_id>')
@login_required
def view_profile(user_id):
    user = User.query.get_or_404(user_id)
    return render_template('profile_preview.html', profile_user=user, current_user=current_user)

@app.route('/music/add', methods=['POST'])
@login_required
def add_music():
    if 'music_file' not in request.files:
        return jsonify({'error': 'Нет файла'}), 400
    
    file = request.files['music_file']
    if not file or not file.filename or not is_music_file(file.filename):
        return jsonify({'error': 'Неверный формат музыки'}), 400
    
    filepath = save_uploaded_file(file, 'music')
    if not filepath:
        return jsonify({'error': 'Ошибка загрузки'}), 500
    
    title = request.form.get('title', 'Без названия')
    artist = request.form.get('artist', 'Неизвестный исполнитель')
    
    cover_url = None
    if 'cover_file' in request.files:
        cover_file = request.files['cover_file']
        if cover_file and cover_file.filename:
            cover_url = save_uploaded_file(cover_file, 'avatars')
    
    music = UserMusic(
        user_id=current_user.id,
        title=title,
        artist=artist,
        file_url=filepath,
        cover_url=cover_url
    )
    db.session.add(music)
    db.session.commit()
    
    return jsonify({'success': True, 'id': music.id})

@app.route('/music/<int:music_id>/delete', methods=['POST'])
@login_required
def delete_music(music_id):
    music = UserMusic.query.get_or_404(music_id)
    if music.user_id != current_user.id:
        return jsonify({'error': 'Нет доступа'}), 403
    
    db.session.delete(music)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/message/<int:message_id>/delete', methods=['POST'])
@login_required
def delete_message(message_id):
    message = Message.query.get_or_404(message_id)
    channel = Channel.query.get(message.channel_id)
    room = Room.query.get(channel.room_id) if channel else None
    
    if not room:
        return jsonify({'error': 'Комната не найдена'}), 404
    
    role = get_role(current_user.id, room.id)
    
    # Можно удалить свое сообщение или быть админом/владельцем
    can_delete = (message.user_id == current_user.id) or (role in ['owner', 'admin'])
    
    if not can_delete:
        return jsonify({'error': 'Нет доступа'}), 403
    
    channel_id = message.channel_id
    db.session.delete(message)
    db.session.commit()
    
    # Уведомляем всех в канале об удалении
    socketio.emit('message_deleted', {
        'message_id': message_id,
        'channel_id': channel_id
    }, room=str(channel_id))
    
    return jsonify({'success': True})

@app.route('/message/<int:message_id>/edit', methods=['POST'])
@login_required
def edit_message(message_id):
    message = Message.query.get_or_404(message_id)
    if message.user_id != current_user.id:
        return jsonify({'error': 'Нет доступа'}), 403
    
    new_content = request.json.get('content', '')
    if new_content:
        message.content = new_content
        message.edited_at = datetime.utcnow()
        db.session.commit()
        
    # Загружаем реакции для сообщения
    reactions_data = {}
    for reaction in message.reactions:
        if reaction.emoji not in reactions_data:
            reactions_data[reaction.emoji] = []
        reactions_data[reaction.emoji].append(reaction.user.username)
    
    # Уведомляем всех об изменении
    socketio.emit('message_edited', {
        'message_id': message_id,
        'content': new_content,
        'channel_id': message.channel_id,
        'edited_at': message.edited_at.strftime('%H:%M'),
        'reactions': reactions_data
    }, room=str(message.channel_id))
    
    return jsonify({'success': True})

@app.route('/message/<int:message_id>/forward', methods=['POST'])
@login_required
def forward_message(message_id):
    message = Message.query.get_or_404(message_id)
    target_channel_id = request.json.get('channel_id')
    
    if not target_channel_id:
        return jsonify({'error': 'Не указан канал'}), 400
    
    # Проверяем доступ к целевому каналу
    target_channel = Channel.query.get(target_channel_id)
    if not target_channel:
        return jsonify({'error': 'Канал не найден'}), 404
    
    role = get_role(current_user.id, target_channel.room_id)
    if not role or role == 'banned':
        return jsonify({'error': 'Нет доступа'}), 403
    
    # Создаем пересланное сообщение
    forwarded_content = f"Переслано от {message.user.username}:\n{message.content}"
    new_msg = Message(
        content=forwarded_content,
        user_id=current_user.id,
        channel_id=target_channel_id,
        message_type=message.message_type,
        file_url=message.file_url,
        file_name=message.file_name,
        file_size=message.file_size
    )
    db.session.add(new_msg)
    db.session.commit()
    
    # Отправляем через socket
    socketio.emit('receive_message', {
        'id': new_msg.id,
        'user_id': current_user.id,
        'username': current_user.username,
        'avatar': current_user.avatar_url,
        'msg': forwarded_content,
        'timestamp': new_msg.timestamp.strftime('%H:%M'),
        'message_type': new_msg.message_type,
        'file_url': new_msg.file_url,
        'file_name': new_msg.file_name,
        'file_size': new_msg.file_size
    }, room=str(target_channel_id))
    
    return jsonify({'success': True})

@app.route('/message/<int:message_id>/reaction', methods=['POST'])
@login_required
def toggle_reaction(message_id):
    message = Message.query.get_or_404(message_id)
    emoji = request.json.get('emoji')
    reaction_type = request.json.get('reaction_type', 'emoji')
    
    if not emoji:
        return jsonify({'error': 'Не указана реакция'}), 400
    
    # Проверяем, есть ли уже такая реакция от этого пользователя
    existing = MessageReaction.query.filter_by(
        message_id=message_id,
        user_id=current_user.id,
        emoji=emoji
    ).first()
    
    if existing:
        # Удаляем реакцию
        db.session.delete(existing)
        action = 'removed'
    else:
        # Добавляем реакцию
        reaction = MessageReaction(
            message_id=message_id,
            user_id=current_user.id,
            emoji=emoji,
            reaction_type=reaction_type
        )
        db.session.add(reaction)
        action = 'added'
    
    db.session.commit()
    
    # Уведомляем всех об изменении реакций
    reactions = MessageReaction.query.filter_by(message_id=message_id).all()
    reaction_data = {}
    for r in reactions:
        if r.emoji not in reaction_data:
            reaction_data[r.emoji] = []
        reaction_data[r.emoji].append(r.user.username)
    
    socketio.emit('reactions_updated', {
        'message_id': message_id,
        'reactions': reaction_data,
        'action': action,
        'emoji': emoji,
        'user': current_user.username
    }, room=str(message.channel_id))
    
    return jsonify({'success': True, 'action': action, 'reactions': reaction_data})


# --- АВТОРИЗАЦИЯ (Login/Register) - Оставляем старые, добавляя поля ---
@app.route('/login', methods=['GET', 'POST'])
def login():
    # ... (код из прошлого ответа, без изменений)
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('dashboard'))
        flash('Ошибка входа')
    return render_template('login.html') # Используй старый шаблон

@app.route('/register', methods=['GET', 'POST'])
def register():
    # ... (код из прошлого ответа)
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if User.query.filter_by(username=username).first():
            return "User exists"
        new_user = User(username=username, password=generate_password_hash(password, method='scrypt'))
        db.session.add(new_user)
        db.session.commit()
        login_user(new_user)
        return redirect(url_for('dashboard'))
    return render_template('register.html') # Используй старый шаблон

@app.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/room/<int:room_id>/delete', methods=['POST'])
@login_required
def delete_room(room_id):
    room = Room.query.get_or_404(room_id)
    member = Member.query.filter_by(user_id=current_user.id, room_id=room_id).first()
    
    if not member:
        return jsonify({'error': 'Вы не являетесь участником'}), 403
    
    # Удалить может только владелец или админ
    if member.role not in ['owner', 'admin']:
        return jsonify({'error': 'Нет прав для удаления сервера'}), 403
    
    # Удаляем всех участников явно перед удалением комнаты
    Member.query.filter_by(room_id=room_id).delete()
    # Удаляем комнату (каскадное удаление удалит все связанные данные)
    db.session.delete(room)
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/room/<int:room_id>/leave', methods=['POST'])
@login_required
def leave_room(room_id):
    room = Room.query.get_or_404(room_id)
    member = Member.query.filter_by(user_id=current_user.id, room_id=room_id).first()
    
    if not member:
        return jsonify({'error': 'Вы не являетесь участником'}), 403
    
    # Владелец не может покинуть сервер (должен удалить его)
    if member.role == 'owner':
        return jsonify({'error': 'Владелец не может покинуть сервер. Удалите сервер вместо этого.'}), 403
    
    # Удаляем участника
    db.session.delete(member)
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/room/<int:room_id>/delete_dm', methods=['POST'])
@login_required
def delete_dm(room_id):
    room = Room.query.get_or_404(room_id)
    if room.type != 'dm':
        return jsonify({'error': 'Это не личное сообщение'}), 400
    
    member = Member.query.filter_by(user_id=current_user.id, room_id=room_id).first()
    if not member:
        return jsonify({'error': 'Вы не являетесь участником'}), 403
    
    # Удаляем участника (не удаляем саму комнату, чтобы другой пользователь мог видеть историю)
    db.session.delete(member)
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/room/<int:room_id>/invite', methods=['POST'])
@login_required
def generate_invite(room_id):
    room = Room.query.get_or_404(room_id)
    member = Member.query.filter_by(user_id=current_user.id, room_id=room_id).first()
    
    if not member or member.role not in ['owner', 'admin']:
        return jsonify({'error': 'Нет прав для создания приглашений'}), 403
    
    # Генерируем токен приглашения
    import secrets
    if not room.invite_token:
        room.invite_token = secrets.token_urlsafe(32)
        db.session.commit()
    
    invite_url = request.url_root.rstrip('/') + url_for('join_room_by_invite', token=room.invite_token)
    return jsonify({'success': True, 'invite_url': invite_url})

@app.route('/join/<token>')
@login_required
def join_room_by_invite(token):
    room = Room.query.filter_by(invite_token=token).first_or_404()
    
    # Проверяем, не является ли пользователь уже участником
    existing_member = Member.query.filter_by(user_id=current_user.id, room_id=room.id).first()
    if existing_member:
        return redirect(url_for('view_room', room_id=room.id))
    
    # Добавляем пользователя как участника
    new_member = Member(user_id=current_user.id, room_id=room.id, role='member')
    db.session.add(new_member)
    db.session.commit()
    
    flash(f'Вы присоединились к {room.name}')
    return redirect(url_for('view_room', room_id=room.id))

@app.route('/user/avatar/delete', methods=['POST'])
@login_required
def delete_user_avatar():
    if current_user.avatar_url and current_user.avatar_url != "https://via.placeholder.com/50":
        # Удаляем файл если он локальный
        if current_user.avatar_url.startswith('/uploads/'):
            try:
                filepath = current_user.avatar_url.lstrip('/')
                if os.path.exists(filepath):
                    os.remove(filepath)
            except:
                pass
        
        current_user.avatar_url = "https://via.placeholder.com/50"
        db.session.commit()
    
    return jsonify({'success': True})

@app.route('/user/delete', methods=['POST'])
@login_required
def delete_user_account():
    data = request.json
    password = data.get('password')
    
    if not password:
        return jsonify({'error': 'Не указан пароль'}), 400
    
    # Проверяем пароль (check_password_hash принимает хеш и пароль)
    if not check_password_hash(current_user.password, password):
        return jsonify({'error': 'Неверный пароль'}), 403
    
    user_id = current_user.id
    
    # Удаляем все данные пользователя
    try:
        # Удаляем музыку
        UserMusic.query.filter_by(user_id=user_id).delete()
        
        # Удаляем стикерпаки и стикеры
        sticker_packs = StickerPack.query.filter_by(owner_id=user_id).all()
        for pack in sticker_packs:
            Sticker.query.filter_by(pack_id=pack.id).delete()
            db.session.delete(pack)
        
        # Удаляем реакции пользователя
        MessageReaction.query.filter_by(user_id=user_id).delete()
        
        # Удаляем записи о прочитанных сообщениях
        ReadMessage.query.filter_by(user_id=user_id).delete()
        
        # Удаляем участников из комнат (но не сами комнаты)
        Member.query.filter_by(user_id=user_id).delete()
        
        # Удаляем сообщения пользователя (или помечаем как удаленные)
        # Можно оставить сообщения, но убрать связь с пользователем
        # Или удалить полностью - решаем удалить
        Message.query.filter_by(user_id=user_id).delete()
        
        # Удаляем файлы пользователя
        # Аватары
        if current_user.avatar_url and current_user.avatar_url.startswith('/uploads/'):
            try:
                filepath = current_user.avatar_url.lstrip('/')
                if os.path.exists(filepath):
                    os.remove(filepath)
            except:
                pass
        
        # Удаляем сам аккаунт
        logout_user()
        db.session.delete(current_user)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при удалении аккаунта: {str(e)}'}), 500

@app.route('/room/<int:room_id>/avatar/delete', methods=['POST'])
@login_required
def delete_room_avatar(room_id):
    room = Room.query.get_or_404(room_id)
    member = Member.query.filter_by(user_id=current_user.id, room_id=room_id).first()
    
    if not member or member.role not in ['owner', 'admin']:
        return jsonify({'error': 'Нет прав'}), 403
    
    if room.avatar_url:
        # Удаляем файл если он локальный
        if room.avatar_url.startswith('/uploads/'):
            try:
                filepath = room.avatar_url.lstrip('/')
                if os.path.exists(filepath):
                    os.remove(filepath)
            except:
                pass
        
        room.avatar_url = None
        db.session.commit()
    
    return jsonify({'success': True})

@app.route('/channels/accessible')
@login_required
def get_accessible_channels():
    """Получить список доступных каналов для пересылки сообщений"""
    # Получаем все комнаты, где пользователь является участником
    rooms = db.session.query(Room).join(Member).filter(
        Member.user_id == current_user.id
    ).all()
    
    channels_list = []
    for room in rooms:
        for channel in room.channels:
            channels_list.append({
                'id': channel.id,
                'name': channel.name,
                'room_id': room.id,
                'room_name': room.name,
                'room_type': room.type
            })
    
    return jsonify({'channels': channels_list})

# --- SOCKET.IO ---

@socketio.on('join')
def on_join(data):
    channel_id = data.get('channel_id')
    if channel_id:
        join_room(str(channel_id))  # Преобразуем в строку для совместимости
    
    # Также подключаемся к персональной комнате для уведомлений
    try:
        if hasattr(current_user, 'is_authenticated') and current_user.is_authenticated:
            join_room(f"user_{current_user.id}")
    except:
        pass  # Если пользователь не аутентифицирован, пропускаем

@socketio.on('send_message')
def handle_send_message(data):
    channel_id = data['channel_id']
    content = data.get('msg', '')
    room_id = data['room_id']
    message_type = data.get('message_type', 'text')
    file_url = data.get('file_url')
    file_name = data.get('file_name')
    file_size = data.get('file_size')
    
    # Нормализуем текст: убираем начальные/конечные пробелы и переносы строк,
    # но сохраняем переносы строк внутри текста
    if content and isinstance(content, str):
        # Убираем начальные и конечные пробелы/переносы строк
        content = content.strip()
        # Убираем пробелы в начале каждой строки (но сохраняем переносы строк)
        lines = content.split('\n')
        # Убираем пустые строки в начале и конце
        while lines and not lines[0].strip():
            lines.pop(0)
        while lines and not lines[-1].strip():
            lines.pop()
        # Убираем начальные пробелы из каждой строки, но сохраняем переносы
        content = '\n'.join(line.lstrip() for line in lines)
    
    # Проверка прав (если это Блог - писать может только админ)
    room = Room.query.get(room_id)
    role = get_role(current_user.id, room_id)
    
    can_post = True
    if room.type == 'broadcast' and role not in ['owner', 'admin']:
        can_post = False
    
    if can_post:
        msg = Message(
            content=content,
            user_id=current_user.id,
            channel_id=channel_id,
            message_type=message_type,
            file_url=file_url,
            file_name=file_name,
            file_size=file_size
        )
        db.session.add(msg)
        db.session.commit()
        
        # Загружаем реакции для сообщения
        reactions_data = {}
        for reaction in msg.reactions:
            if reaction.emoji not in reactions_data:
                reactions_data[reaction.emoji] = []
            reactions_data[reaction.emoji].append(reaction.user.username)
        
        emit('receive_message', {
            'id': msg.id,
            'user_id': current_user.id,
            'username': current_user.username,
            'avatar': current_user.avatar_url,
            'msg': content,
            'timestamp': msg.timestamp.strftime('%H:%M'),
            'message_type': message_type,
            'file_url': file_url,
            'file_name': file_name,
            'file_size': file_size,
            'edited_at': msg.edited_at.strftime('%H:%M') if msg.edited_at else None,
            'reactions': reactions_data
        }, room=str(channel_id))

if __name__ == '__main__':
    socketio.run(app, debug=True)
