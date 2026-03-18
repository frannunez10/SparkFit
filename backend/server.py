from fastapi import FastAPI, APIRouter, HTTPException, Depends, Cookie, Response, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import asyncio
import resend
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Resend setup
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# JWT setup
JWT_SECRET = os.environ.get('JWT_SECRET', 'sparkfit_secret_key_change_in_production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_DAYS = 7

# Business hours configuration
BUSINESS_HOURS = {
    'weekdays': [
        {'start': 6, 'end': 13},  # 6am - 1pm (last slot at 12pm)
        {'start': 15, 'end': 22}  # 3pm - 10pm (last slot at 9pm)
    ]
}

# Activity availability
ACTIVITY_SCHEDULE = {
    'entrenamiento': {'days': [0, 1, 2, 3, 4], 'hours': list(range(6, 13)) + list(range(15, 22))},  # L-V all hours
    'rehabilitacion': {'days': [0, 1, 2, 3, 4], 'hours': list(range(6, 13)) + list(range(15, 22))},  # L-V all hours
    'nutricion': {'days': [1, 3, 5], 'hours': [10, 11, 12]}  # Ma, Ju, Sa at 10, 11, 12
}

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = 'client'

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    user_id: str
    email: str
    name: str
    role: str
    credits: int = 0
    phone: Optional[str] = None
    created_at: str

class GoogleSessionRequest(BaseModel):
    session_id: str

class BookingCreate(BaseModel):
    date: str
    time: str
    activity_type: str

class Booking(BaseModel):
    booking_id: str
    user_id: str
    date: str
    time: str
    activity_type: str
    credits_cost: int
    status: str
    created_at: str
    cancelled_at: Optional[str] = None

class CreditAssignment(BaseModel):
    user_id: str
    credits: int
    reason: str

class AttendanceUpdate(BaseModel):
    booking_id: str
    status: str  # 'attended' or 'absent'

class PasswordChange(BaseModel):
    user_id: str
    new_password: str

class ActivityConfig(BaseModel):
    activity_type: str
    credits_cost: int
    max_capacity: int

class ScheduleOverride(BaseModel):
    date: str
    is_closed: bool
    custom_hours: Optional[List[int]] = None

class WeeklyScheduleConfig(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    is_closed: bool = False
    custom_hours: Optional[List[int]] = None

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, email: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: Optional[str] = Cookie(None, alias='session_token')) -> User:
    token = authorization
    
    if not token:
        raise HTTPException(status_code=401, detail='No autenticado')
    
    session_doc = await db.user_sessions.find_one({'session_token': token}, {'_id': 0})
    if session_doc:
        expires_at = session_doc['expires_at']
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail='Sesión expirada')
        
        user_doc = await db.users.find_one({'user_id': session_doc['user_id']}, {'_id': 0})
        if not user_doc:
            raise HTTPException(status_code=404, detail='Usuario no encontrado')
        return User(**user_doc)
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_doc = await db.users.find_one({'user_id': payload['user_id']}, {'_id': 0})
        if not user_doc:
            raise HTTPException(status_code=404, detail='Usuario no encontrado')
        return User(**user_doc)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expirado')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Token inválido')

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail='Acceso denegado')
    return current_user

async def send_email_async(recipient: str, subject: str, html: str):
    if not RESEND_API_KEY:
        logger.warning('RESEND_API_KEY not configured, skipping email')
        return
    
    params = {'from': SENDER_EMAIL, 'to': [recipient], 'subject': subject, 'html': html}
    
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f'Email sent to {recipient}: {email.get("id")}')
    except Exception as e:
        logger.error(f'Failed to send email: {str(e)}')

async def get_activity_config(activity_type: str) -> Dict:
    """Get activity configuration (price, capacity)"""
    config = await db.activity_config.find_one({'activity_type': activity_type}, {'_id': 0})
    if not config:
        # Default values
        defaults = {
            'entrenamiento': {'credits_cost': 1, 'max_capacity': 5},
            'rehabilitacion': {'credits_cost': 1, 'max_capacity': 5},
            'nutricion': {'credits_cost': 2, 'max_capacity': 1}
        }
        return defaults.get(activity_type, {'credits_cost': 1, 'max_capacity': 5})
    return config

async def is_date_closed(date_str: str) -> tuple[bool, Optional[List[int]]]:
    """Check if a date is closed or has custom hours"""
    # First check for specific date override
    override = await db.schedule_overrides.find_one({'date': date_str}, {'_id': 0})
    if override:
        return override.get('is_closed', False), override.get('custom_hours')
    
    # Then check for weekly schedule configuration
    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
    day_of_week = date_obj.weekday()
    weekly_config = await db.weekly_schedule.find_one({'day_of_week': day_of_week}, {'_id': 0})
    if weekly_config:
        return weekly_config.get('is_closed', False), weekly_config.get('custom_hours')
    
    return False, None

def get_available_activities(date_str: str, hour: int) -> List[str]:
    """Get activities available for a specific date and hour"""
    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
    day_of_week = date_obj.weekday()  # 0=Monday, 6=Sunday
    
    # Sunday is closed
    if day_of_week == 6:
        return []
    
    available = []
    for activity, schedule in ACTIVITY_SCHEDULE.items():
        if day_of_week in schedule['days'] and hour in schedule['hours']:
            available.append(activity)
    
    return available

# ==================== AUTH ENDPOINTS ====================

@api_router.post('/auth/register')
async def register(user_data: UserCreate):
    existing = await db.users.find_one({'email': user_data.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail='El email ya está registrado')
    
    hashed_pwd = hash_password(user_data.password)
    user_id = f'user_{uuid.uuid4().hex[:12]}'
    
    clean_user = {
        'user_id': user_id,
        'email': user_data.email,
        'password': hashed_pwd,
        'name': user_data.name,
        'role': user_data.role,
        'credits': 0,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(clean_user)
    token = create_jwt_token(user_id, user_data.email, user_data.role)
    
    clean_user.pop('password')
    return {'user': clean_user, 'token': token}

@api_router.post('/auth/login')
async def login(credentials: UserLogin, response: Response):
    user_doc = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user_doc or not verify_password(credentials.password, user_doc['password']):
        raise HTTPException(status_code=401, detail='Credenciales inválidas')
    
    token = create_jwt_token(user_doc['user_id'], user_doc['email'], user_doc['role'])
    
    response.set_cookie(
        key='session_token', value=token, httponly=True, secure=True,
        samesite='none', max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60, path='/'
    )
    
    user_doc.pop('password')
    return {'user': user_doc, 'token': token}

@api_router.post('/auth/google-session')
async def google_session(request: GoogleSessionRequest, response: Response):
    session_id = request.session_id
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
            headers={'X-Session-ID': session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail='Sesión inválida')
        session_data = resp.json()
    
    email = session_data['email']
    name = session_data['name']
    picture = session_data.get('picture', '')
    session_token = session_data['session_token']
    
    user_doc = await db.users.find_one({'email': email}, {'_id': 0})
    
    if not user_doc:
        user_id = f'user_{uuid.uuid4().hex[:12]}'
        user_doc = {
            'user_id': user_id, 'email': email, 'name': name,
            'role': 'client', 'credits': 0, 'picture': picture,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    else:
        user_id = user_doc['user_id']
        await db.users.update_one(
            {'user_id': user_id},
            {'$set': {'name': name, 'picture': picture}}
        )
        user_doc['name'] = name
        user_doc['picture'] = picture
    
    await db.user_sessions.insert_one({
        'user_id': user_id, 'session_token': session_token,
        'expires_at': datetime.now(timezone.utc) + timedelta(days=7),
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    response.set_cookie(
        key='session_token', value=session_token, httponly=True,
        secure=True, samesite='none', max_age=7 * 24 * 60 * 60, path='/'
    )
    
    if 'password' in user_doc:
        user_doc.pop('password')
    
    return {'user': user_doc, 'session_token': session_token}

@api_router.get('/auth/me')
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post('/auth/logout')
async def logout(response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_many({'session_token': session_token})
    response.delete_cookie(key='session_token', path='/')
    return {'message': 'Sesión cerrada'}

# ==================== CLIENT ENDPOINTS ====================

@api_router.get('/calendar/available-slots')
async def get_available_time_slots(date: str = Query(...), current_user: User = Depends(get_current_user)):
    """Get available time slots for a specific date"""
    try:
        date_obj = datetime.strptime(date, '%Y-%m-%d')
    except:
        raise HTTPException(status_code=400, detail='Formato de fecha inválido')
    
    today = datetime.now(timezone.utc).date()
    target_date = date_obj.date()
    days_diff = (target_date - today).days
    
    if days_diff < 0 or days_diff > 7:
        return []
    
    if date_obj.weekday() == 6:
        return []
    
    is_closed, custom_hours = await is_date_closed(date)
    if is_closed:
        return []
    
    if custom_hours:
        available_hours = custom_hours
    else:
        available_hours = list(range(6, 13)) + list(range(15, 22))
    
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    current_minute = now.minute
    
    time_slots = []
    MAX_CAPACITY = 5  # Total capacity per time slot
    
    for hour in available_hours:
        if target_date == today:
            if hour <= current_hour:
                continue
            if hour == current_hour + 1 and current_minute > 0:
                continue
        
        time_str = f"{hour:02d}:00"
        activities = get_available_activities(date, hour)
        
        # Count TOTAL bookings for this time slot (all activities combined)
        total_bookings = await db.bookings.count_documents({
            'date': date,
            'time': time_str,
            'status': 'confirmed'
        })
        
        has_availability = total_bookings < MAX_CAPACITY
        
        activities_info = []
        for activity in activities:
            config = await get_activity_config(activity)
            
            # Activity is available if there's still space in the total slot
            is_available = has_availability
            
            activities_info.append({
                'activity_type': activity,
                'available': is_available,
                'credits_cost': config['credits_cost']
            })
        
        if activities_info:
            time_slots.append({
                'time': time_str,
                'has_availability': has_availability,
                'is_full': not has_availability,
                'activities': activities_info
            })
    
    return time_slots

@api_router.post('/bookings')
async def create_booking(booking_data: BookingCreate, current_user: User = Depends(get_current_user)):
    """Create a new booking"""
    try:
        booking_datetime = datetime.strptime(f"{booking_data.date} {booking_data.time}", '%Y-%m-%d %H:%M')
    except:
        raise HTTPException(status_code=400, detail='Formato de fecha/hora inválido')
    
    # Check 1-hour advance booking
    now = datetime.now(timezone.utc)
    time_until_booking = (booking_datetime - now.replace(tzinfo=None)).total_seconds() / 3600
    if time_until_booking < 1:
        raise HTTPException(status_code=400, detail='Debe reservar con mínimo 1 hora de anticipación')
    
    # Get activity config
    config = await get_activity_config(booking_data.activity_type)
    credits_cost = config['credits_cost']
    
    # Check user credits
    if current_user.credits < credits_cost:
        raise HTTPException(status_code=400, detail='Créditos insuficientes')
    
    # Check if user already has a booking for this slot
    existing = await db.bookings.find_one({
        'user_id': current_user.user_id,
        'date': booking_data.date,
        'time': booking_data.time,
        'status': 'confirmed'
    }, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail='Ya tienes una reserva para este horario')
    
    # Check TOTAL capacity for the time slot (all activities combined)
    MAX_CAPACITY = 5
    total_bookings = await db.bookings.count_documents({
        'date': booking_data.date,
        'time': booking_data.time,
        'status': 'confirmed'
    })
    
    if total_bookings >= MAX_CAPACITY:
        raise HTTPException(status_code=400, detail='No hay cupos disponibles para este horario')
    
    # Create booking
    booking_id = f'booking_{uuid.uuid4().hex[:12]}'
    booking_doc = {
        'booking_id': booking_id,
        'user_id': current_user.user_id,
        'date': booking_data.date,
        'time': booking_data.time,
        'activity_type': booking_data.activity_type,
        'credits_cost': credits_cost,
        'status': 'confirmed',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.bookings.insert_one(booking_doc)
    
    # Deduct credits
    await db.users.update_one(
        {'user_id': current_user.user_id},
        {'$inc': {'credits': -credits_cost}}
    )
    
    # Send confirmation email
    activity_labels = {
        'entrenamiento': 'Entrenamiento',
        'rehabilitacion': 'Rehabilitación',
        'nutricion': 'Nutrición'
    }
    html = f"""
    <h2>Reserva Confirmada - Spark Fit</h2>
    <p>Hola {current_user.name},</p>
    <p>Tu reserva ha sido confirmada:</p>
    <ul>
        <li><strong>Actividad:</strong> {activity_labels.get(booking_data.activity_type, booking_data.activity_type)}</li>
        <li><strong>Fecha:</strong> {booking_data.date}</li>
        <li><strong>Hora:</strong> {booking_data.time}</li>
        <li><strong>Créditos:</strong> {credits_cost}</li>
    </ul>
    <p>Saldo restante: {current_user.credits - credits_cost} créditos</p>
    <p><strong>Recordatorio:</strong> Puedes cancelar hasta 6 horas antes sin perder créditos.</p>
    <p>¡Te esperamos en Spark Fit!</p>
    """
    await send_email_async(current_user.email, 'Reserva Confirmada - Spark Fit', html)
    
    return Booking(**booking_doc)

@api_router.get('/bookings/my')
async def get_my_bookings(current_user: User = Depends(get_current_user)):
    bookings = await db.bookings.find({'user_id': current_user.user_id}, {'_id': 0}).to_list(1000)
    return bookings

@api_router.delete('/bookings/{booking_id}')
async def cancel_booking(booking_id: str, current_user: User = Depends(get_current_user)):
    booking_doc = await db.bookings.find_one({'booking_id': booking_id}, {'_id': 0})
    if not booking_doc:
        raise HTTPException(status_code=404, detail='Reserva no encontrada')
    
    if booking_doc['user_id'] != current_user.user_id:
        raise HTTPException(status_code=403, detail='No puedes cancelar esta reserva')
    
    if booking_doc['status'] == 'cancelled':
        raise HTTPException(status_code=400, detail='La reserva ya está cancelada')
    
    # Check 6-hour cancellation policy
    booking_datetime = datetime.strptime(f"{booking_doc['date']} {booking_doc['time']}", '%Y-%m-%d %H:%M')
    now = datetime.now(timezone.utc)
    hours_until = (booking_datetime - now.replace(tzinfo=None)).total_seconds() / 3600
    
    refund_credits = hours_until > 6
    
    # Cancel booking
    await db.bookings.update_one(
        {'booking_id': booking_id},
        {'$set': {'status': 'cancelled', 'cancelled_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    # Refund credits if applicable
    if refund_credits:
        await db.users.update_one(
            {'user_id': current_user.user_id},
            {'$inc': {'credits': booking_doc['credits_cost']}}
        )
    
    # Send cancellation email
    activity_labels = {
        'entrenamiento': 'Entrenamiento',
        'rehabilitacion': 'Rehabilitación',
        'nutricion': 'Nutrición'
    }
    html = f"""
    <h2>Reserva Cancelada - Spark Fit</h2>
    <p>Hola {current_user.name},</p>
    <p>Tu reserva ha sido cancelada:</p>
    <ul>
        <li><strong>Actividad:</strong> {activity_labels.get(booking_doc['activity_type'], booking_doc['activity_type'])}</li>
        <li><strong>Fecha:</strong> {booking_doc['date']}</li>
        <li><strong>Hora:</strong> {booking_doc['time']}</li>
    </ul>
    <p>{'Se han devuelto ' + str(booking_doc['credits_cost']) + ' créditos a tu cuenta.' if refund_credits else 'No se devolvieron créditos (cancelación con menos de 6 horas de anticipación).'}</p>
    <p>Saldo actual: {current_user.credits + (booking_doc['credits_cost'] if refund_credits else 0)} créditos</p>
    """
    await send_email_async(current_user.email, 'Reserva Cancelada - Spark Fit', html)
    
    return {
        'message': 'Reserva cancelada',
        'refunded': refund_credits,
        'credits_refunded': booking_doc['credits_cost'] if refund_credits else 0
    }

# ==================== ADMIN ENDPOINTS ====================

@api_router.get('/admin/calendar-day')
async def get_calendar_day(date: str = Query(...), admin: User = Depends(get_admin_user)):
    """Get full schedule for a specific day"""
    # Get all bookings for this date
    bookings = await db.bookings.find({'date': date, 'status': 'confirmed'}, {'_id': 0}).to_list(1000)
    
    # Get all possible hours
    date_obj = datetime.strptime(date, '%Y-%m-%d')
    if date_obj.weekday() == 6:  # Sunday
        return {'date': date, 'is_closed': True, 'schedule': []}
    
    is_closed, custom_hours = await is_date_closed(date)
    if is_closed:
        return {'date': date, 'is_closed': True, 'schedule': []}
    
    hours = custom_hours if custom_hours else (list(range(6, 13)) + list(range(15, 22)))
    
    MAX_CAPACITY = 5
    schedule = []
    
    for hour in hours:
        time_str = f"{hour:02d}:00"
        hour_bookings = [b for b in bookings if b['time'] == time_str]
        
        # Enrich bookings with user info
        for booking in hour_bookings:
            user = await db.users.find_one({'user_id': booking['user_id']}, {'_id': 0, 'password': 0})
            booking['user'] = user
        
        slot_info = {
            'time': time_str,
            'total_bookings': len(hour_bookings),
            'max_capacity': MAX_CAPACITY,
            'bookings': hour_bookings
        }
        
        schedule.append(slot_info)
    
    return {'date': date, 'is_closed': False, 'schedule': schedule}

@api_router.get('/admin/config/activities')
async def get_activities_config(admin: User = Depends(get_admin_user)):
    """Get configuration for all activities"""
    configs = await db.activity_config.find({}, {'_id': 0}).to_list(100)
    
    # Ensure all activities have config
    default_activities = ['entrenamiento', 'rehabilitacion', 'nutricion']
    for activity in default_activities:
        if not any(c['activity_type'] == activity for c in configs):
            config = await get_activity_config(activity)
            configs.append({'activity_type': activity, **config})
    
    return configs

@api_router.put('/admin/config/activity')
async def update_activity_config(config: ActivityConfig, admin: User = Depends(get_admin_user)):
    """Update activity configuration"""
    await db.activity_config.update_one(
        {'activity_type': config.activity_type},
        {'$set': {
            'credits_cost': config.credits_cost,
            'max_capacity': config.max_capacity
        }},
        upsert=True
    )
    return {'message': 'Configuración actualizada'}

@api_router.post('/admin/schedule-override')
async def create_schedule_override(override: ScheduleOverride, admin: User = Depends(get_admin_user)):
    """Create or update schedule override for a specific date"""
    await db.schedule_overrides.update_one(
        {'date': override.date},
        {'$set': {
            'is_closed': override.is_closed,
            'custom_hours': override.custom_hours
        }},
        upsert=True
    )
    return {'message': 'Horario actualizado'}

@api_router.get('/admin/schedule-overrides')
async def get_schedule_overrides(admin: User = Depends(get_admin_user)):
    """Get all schedule overrides"""
    overrides = await db.schedule_overrides.find({}, {'_id': 0}).to_list(1000)
    return overrides

@api_router.delete('/admin/schedule-override/{date}')
async def delete_schedule_override(date: str, admin: User = Depends(get_admin_user)):
    """Delete schedule override"""
    await db.schedule_overrides.delete_one({'date': date})
    return {'message': 'Horario restablecido'}

@api_router.post('/admin/weekly-schedule')
async def create_weekly_schedule(config: WeeklyScheduleConfig, admin: User = Depends(get_admin_user)):
    """Configure schedule for a specific day of week (recurring)"""
    await db.weekly_schedule.update_one(
        {'day_of_week': config.day_of_week},
        {'$set': {
            'is_closed': config.is_closed,
            'custom_hours': config.custom_hours
        }},
        upsert=True
    )
    day_names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    return {'message': f'Horario configurado para todos los {day_names[config.day_of_week]}'}

@api_router.get('/admin/weekly-schedules')
async def get_weekly_schedules(admin: User = Depends(get_admin_user)):
    """Get all weekly schedule configurations"""
    schedules = await db.weekly_schedule.find({}, {'_id': 0}).to_list(10)
    return schedules

@api_router.delete('/admin/weekly-schedule/{day_of_week}')
async def delete_weekly_schedule(day_of_week: int, admin: User = Depends(get_admin_user)):
    """Delete weekly schedule configuration"""
    await db.weekly_schedule.delete_one({'day_of_week': day_of_week})
    return {'message': 'Configuración semanal eliminada'}

@api_router.get('/admin/users')
async def get_all_users(admin: User = Depends(get_admin_user)):
    users = await db.users.find({}, {'_id': 0, 'password': 0}).to_list(1000)
    return users

@api_router.post('/admin/credits')
async def assign_credits(assignment: CreditAssignment, admin: User = Depends(get_admin_user)):
    user_doc = await db.users.find_one({'user_id': assignment.user_id}, {'_id': 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail='Usuario no encontrado')
    
    new_credits = user_doc['credits'] + assignment.credits
    if new_credits < 0:
        raise HTTPException(status_code=400, detail='No se pueden asignar créditos que resulten en saldo negativo')
    
    await db.users.update_one(
        {'user_id': assignment.user_id},
        {'$inc': {'credits': assignment.credits}}
    )
    
    await db.credit_transactions.insert_one({
        'transaction_id': f'txn_{uuid.uuid4().hex[:12]}',
        'user_id': assignment.user_id,
        'credits': assignment.credits,
        'reason': assignment.reason,
        'admin_id': admin.user_id,
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    return {'message': 'Créditos asignados', 'new_balance': new_credits}

@api_router.get('/admin/bookings')
async def get_all_bookings(admin: User = Depends(get_admin_user)):
    bookings = await db.bookings.find({}, {'_id': 0}).to_list(1000)
    
    for booking in bookings:
        user_doc = await db.users.find_one({'user_id': booking['user_id']}, {'_id': 0, 'password': 0})
        if user_doc:
            booking['user'] = user_doc
    
    return bookings

@api_router.post('/admin/attendance')
async def mark_attendance(data: AttendanceUpdate, admin: User = Depends(get_admin_user)):
    """Mark a booking as attended or absent"""
    if data.status not in ['attended', 'absent']:
        raise HTTPException(status_code=400, detail='Estado inválido. Usar: attended o absent')
    
    booking = await db.bookings.find_one({'booking_id': data.booking_id}, {'_id': 0})
    if not booking:
        raise HTTPException(status_code=404, detail='Reserva no encontrada')
    
    if booking['status'] == 'cancelled':
        raise HTTPException(status_code=400, detail='No se puede marcar asistencia en una reserva cancelada')
    
    await db.bookings.update_one(
        {'booking_id': data.booking_id},
        {'$set': {'status': data.status, 'marked_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    return {'message': f'Reserva marcada como {data.status}'}

@api_router.post('/admin/change-password')
async def admin_change_password(data: PasswordChange, admin: User = Depends(get_admin_user)):
    """Admin changes a user's password"""
    user_doc = await db.users.find_one({'user_id': data.user_id}, {'_id': 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail='Usuario no encontrado')
    
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail='La contraseña debe tener al menos 6 caracteres')
    
    hashed_pwd = hash_password(data.new_password)
    await db.users.update_one(
        {'user_id': data.user_id},
        {'$set': {'password': hashed_pwd}}
    )
    
    return {'message': 'Contraseña actualizada exitosamente'}

# ==================== ROOT ENDPOINT ====================

@api_router.get('/')
async def root():
    return {'message': 'Spark Fit API v2.0'}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.on_event('shutdown')
async def shutdown_db_client():
    client.close()