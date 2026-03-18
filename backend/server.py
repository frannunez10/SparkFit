from fastapi import FastAPI, APIRouter, HTTPException, Depends, Cookie, Response, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional
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

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = 'client'  # client or admin

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

class SlotCreate(BaseModel):
    activity_type: str  # entrenamiento, rehabilitacion, nutricion
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    max_capacity: int = 5
    credits_cost: int = 1

    @field_validator('activity_type')
    def validate_activity_type(cls, v):
        allowed = ['entrenamiento', 'rehabilitacion', 'nutricion']
        if v.lower() not in allowed:
            raise ValueError(f'activity_type must be one of {allowed}')
        return v.lower()

class Slot(BaseModel):
    slot_id: str
    activity_type: str
    date: str
    time: str
    max_capacity: int
    current_bookings: int = 0
    credits_cost: int
    created_at: str

class BookingCreate(BaseModel):
    slot_id: str

class Booking(BaseModel):
    booking_id: str
    user_id: str
    slot_id: str
    activity_type: str
    date: str
    time: str
    credits_cost: int
    status: str  # confirmed, cancelled
    created_at: str
    cancelled_at: Optional[str] = None

class CreditAssignment(BaseModel):
    user_id: str
    credits: int  # positive to add, negative to remove
    reason: str

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
    
    # Check if it's a Google OAuth session token
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
    
    # Otherwise, try JWT token
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
        raise HTTPException(status_code=403, detail='Acceso denegado: se requiere rol de administrador')
    return current_user

async def send_email_async(recipient: str, subject: str, html: str):
    if not RESEND_API_KEY:
        logger.warning('RESEND_API_KEY not configured, skipping email')
        return
    
    params = {
        'from': SENDER_EMAIL,
        'to': [recipient],
        'subject': subject,
        'html': html
    }
    
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f'Email sent to {recipient}: {email.get("id")}')
    except Exception as e:
        logger.error(f'Failed to send email: {str(e)}')

# ==================== AUTH ENDPOINTS ====================

@api_router.post('/auth/register')
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({'email': user_data.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail='El email ya está registrado')
    
    # Hash password
    hashed_pwd = hash_password(user_data.password)
    
    # Create user
    user_id = f'user_{uuid.uuid4().hex[:12]}'
    user_doc = {
        'user_id': user_id,
        'email': user_data.email,
        'password': hashed_pwd,
        'name': user_data.name,
        'role': user_data.role,
        'credits': 0,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create JWT token
    token = create_jwt_token(user_id, user_data.email, user_data.role)
    
    # Return clean user data without password and _id
    clean_user = {
        'user_id': user_id,
        'email': user_data.email,
        'name': user_data.name,
        'role': user_data.role,
        'credits': 0,
        'created_at': user_doc['created_at']
    }
    
    return {'user': clean_user, 'token': token}

@api_router.post('/auth/login')
async def login(credentials: UserLogin, response: Response):
    user_doc = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user_doc or not verify_password(credentials.password, user_doc['password']):
        raise HTTPException(status_code=401, detail='Credenciales inválidas')
    
    token = create_jwt_token(user_doc['user_id'], user_doc['email'], user_doc['role'])
    
    # Set cookie
    response.set_cookie(
        key='session_token',
        value=token,
        httponly=True,
        secure=True,
        samesite='none',
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
        path='/'
    )
    
    user_doc.pop('password')
    return {'user': user_doc, 'token': token}

@api_router.post('/auth/google-session')
async def google_session(request: GoogleSessionRequest, response: Response):
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
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
    
    # Check if user exists
    user_doc = await db.users.find_one({'email': email}, {'_id': 0})
    
    if not user_doc:
        # Create new user
        user_id = f'user_{uuid.uuid4().hex[:12]}'
        user_doc = {
            'user_id': user_id,
            'email': email,
            'name': name,
            'role': 'client',
            'credits': 0,
            'picture': picture,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    else:
        user_id = user_doc['user_id']
        # Update name and picture if changed
        await db.users.update_one(
            {'user_id': user_id},
            {'$set': {'name': name, 'picture': picture}}
        )
        user_doc['name'] = name
        user_doc['picture'] = picture
    
    # Store session
    await db.user_sessions.insert_one({
        'user_id': user_id,
        'session_token': session_token,
        'expires_at': datetime.now(timezone.utc) + timedelta(days=7),
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    # Set cookie
    response.set_cookie(
        key='session_token',
        value=session_token,
        httponly=True,
        secure=True,
        samesite='none',
        max_age=7 * 24 * 60 * 60,
        path='/'
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

# ==================== ADMIN ENDPOINTS ====================

@api_router.post('/admin/slots', dependencies=[Depends(get_admin_user)])
async def create_slot(slot_data: SlotCreate):
    slot_id = f'slot_{uuid.uuid4().hex[:12]}'
    slot_doc = {
        'slot_id': slot_id,
        'activity_type': slot_data.activity_type,
        'date': slot_data.date,
        'time': slot_data.time,
        'max_capacity': slot_data.max_capacity,
        'current_bookings': 0,
        'credits_cost': slot_data.credits_cost,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.slots.insert_one(slot_doc)
    return Slot(**slot_doc)

@api_router.get('/admin/slots')
async def get_all_slots(admin: User = Depends(get_admin_user)):
    slots = await db.slots.find({}, {'_id': 0}).to_list(1000)
    return slots

@api_router.delete('/admin/slots/{slot_id}')
async def delete_slot(slot_id: str, admin: User = Depends(get_admin_user)):
    # Check if slot has bookings
    bookings = await db.bookings.find({'slot_id': slot_id, 'status': 'confirmed'}, {'_id': 0}).to_list(100)
    if bookings:
        # Cancel all bookings and refund credits
        for booking in bookings:
            await db.bookings.update_one(
                {'booking_id': booking['booking_id']},
                {'$set': {'status': 'cancelled', 'cancelled_at': datetime.now(timezone.utc).isoformat()}}
            )
            await db.users.update_one(
                {'user_id': booking['user_id']},
                {'$inc': {'credits': booking['credits_cost']}}
            )
            
            # Send cancellation email
            user_doc = await db.users.find_one({'user_id': booking['user_id']}, {'_id': 0})
            if user_doc:
                html = f"""
                <h2>Turno Cancelado - Spark Fit</h2>
                <p>Hola {user_doc['name']},</p>
                <p>Tu turno ha sido cancelado por el administrador:</p>
                <ul>
                    <li><strong>Actividad:</strong> {booking['activity_type'].title()}</li>
                    <li><strong>Fecha:</strong> {booking['date']}</li>
                    <li><strong>Hora:</strong> {booking['time']}</li>
                </ul>
                <p>Se han devuelto {booking['credits_cost']} créditos a tu cuenta.</p>
                <p>Saldo actual: {user_doc['credits'] + booking['credits_cost']} créditos</p>
                """
                await send_email_async(user_doc['email'], 'Turno Cancelado - Spark Fit', html)
    
    result = await db.slots.delete_one({'slot_id': slot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Turno no encontrado')
    
    return {'message': 'Turno eliminado y reservas canceladas'}

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
        raise HTTPException(status_code=400, detail='No se pueden asignar créditos negativos que resulten en saldo negativo')
    
    await db.users.update_one(
        {'user_id': assignment.user_id},
        {'$inc': {'credits': assignment.credits}}
    )
    
    # Log transaction
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
    
    # Enrich with user info
    for booking in bookings:
        user_doc = await db.users.find_one({'user_id': booking['user_id']}, {'_id': 0, 'password': 0})
        if user_doc:
            booking['user'] = user_doc
    
    return bookings

# ==================== CLIENT ENDPOINTS ====================

@api_router.get('/calendar/available')
async def get_available_slots(
    date: Optional[str] = Query(None),
    activity_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    # Limit to 1 week in advance
    from datetime import timedelta
    today = datetime.now(timezone.utc).date()
    max_date = today + timedelta(days=7)
    
    query = {}
    if date:
        query_date = datetime.fromisoformat(date).date()
        if query_date > max_date:
            return []
        query['date'] = date
    if activity_type:
        query['activity_type'] = activity_type.lower()
    
    slots = await db.slots.find(query, {'_id': 0}).to_list(1000)
    
    # Add availability info but don't expose exact numbers
    for slot in slots:
        slot['available'] = slot['current_bookings'] < slot['max_capacity']
        slot['is_full'] = slot['current_bookings'] >= slot['max_capacity']
    
    return slots

@api_router.get('/calendar/time-slots')
async def get_time_slots_by_date(
    date: str = Query(...),
    current_user: User = Depends(get_current_user)
):
    """Get available time slots for a specific date, grouped by hour"""
    # Limit to 1 week in advance
    from datetime import timedelta
    today = datetime.now(timezone.utc).date()
    max_date = today + timedelta(days=7)
    query_date = datetime.fromisoformat(date).date()
    
    if query_date > max_date:
        return []
    
    # Get all slots for this date
    slots = await db.slots.find({'date': date}, {'_id': 0}).to_list(1000)
    
    # Group by time and check availability
    time_slots = {}
    for slot in slots:
        time = slot['time']
        if time not in time_slots:
            time_slots[time] = {
                'time': time,
                'slots': [],
                'has_available': False,
                'is_full': True
            }
        
        is_available = slot['current_bookings'] < slot['max_capacity']
        time_slots[time]['slots'].append({
            'slot_id': slot['slot_id'],
            'activity_type': slot['activity_type'],
            'available': is_available,
            'credits_cost': slot['credits_cost']
        })
        
        if is_available:
            time_slots[time]['has_available'] = True
            time_slots[time]['is_full'] = False
    
    # Convert to list and sort by time
    result = sorted(time_slots.values(), key=lambda x: x['time'])
    return result

@api_router.get('/calendar/activities-for-slot')
async def get_activities_for_slot(
    date: str = Query(...),
    time: str = Query(...),
    current_user: User = Depends(get_current_user)
):
    """Get available activities for a specific date and time"""
    slots = await db.slots.find({
        'date': date,
        'time': time
    }, {'_id': 0}).to_list(100)
    
    activities = []
    for slot in slots:
        if slot['current_bookings'] < slot['max_capacity']:
            activities.append({
                'slot_id': slot['slot_id'],
                'activity_type': slot['activity_type'],
                'credits_cost': slot['credits_cost']
            })
    
    return activities

@api_router.post('/bookings')
async def create_booking(booking_data: BookingCreate, current_user: User = Depends(get_current_user)):
    # Get slot
    slot_doc = await db.slots.find_one({'slot_id': booking_data.slot_id}, {'_id': 0})
    if not slot_doc:
        raise HTTPException(status_code=404, detail='Turno no encontrado')
    
    # Check availability
    if slot_doc['current_bookings'] >= slot_doc['max_capacity']:
        raise HTTPException(status_code=400, detail='Turno lleno')
    
    # Check user credits
    if current_user.credits < slot_doc['credits_cost']:
        raise HTTPException(status_code=400, detail='Créditos insuficientes')
    
    # Check if user already booked this slot
    existing = await db.bookings.find_one({
        'user_id': current_user.user_id,
        'slot_id': booking_data.slot_id,
        'status': 'confirmed'
    }, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail='Ya tienes una reserva para este turno')
    
    # Create booking
    booking_id = f'booking_{uuid.uuid4().hex[:12]}'
    booking_doc = {
        'booking_id': booking_id,
        'user_id': current_user.user_id,
        'slot_id': booking_data.slot_id,
        'activity_type': slot_doc['activity_type'],
        'date': slot_doc['date'],
        'time': slot_doc['time'],
        'credits_cost': slot_doc['credits_cost'],
        'status': 'confirmed',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.bookings.insert_one(booking_doc)
    
    # Update slot bookings count
    await db.slots.update_one(
        {'slot_id': booking_data.slot_id},
        {'$inc': {'current_bookings': 1}}
    )
    
    # Deduct credits
    await db.users.update_one(
        {'user_id': current_user.user_id},
        {'$inc': {'credits': -slot_doc['credits_cost']}}
    )
    
    # Send confirmation email
    html = f"""
    <h2>Reserva Confirmada - Spark Fit</h2>
    <p>Hola {current_user.name},</p>
    <p>Tu reserva ha sido confirmada:</p>
    <ul>
        <li><strong>Actividad:</strong> {slot_doc['activity_type'].title()}</li>
        <li><strong>Fecha:</strong> {slot_doc['date']}</li>
        <li><strong>Hora:</strong> {slot_doc['time']}</li>
        <li><strong>Créditos:</strong> {slot_doc['credits_cost']}</li>
    </ul>
    <p>Saldo restante: {current_user.credits - slot_doc['credits_cost']} créditos</p>
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
    
    # Check cancellation policy (6 hours)
    booking_datetime = datetime.fromisoformat(f"{booking_doc['date']}T{booking_doc['time']}:00")
    if booking_datetime.tzinfo is None:
        booking_datetime = booking_datetime.replace(tzinfo=timezone.utc)
    
    now = datetime.now(timezone.utc)
    hours_until = (booking_datetime - now).total_seconds() / 3600
    
    refund_credits = hours_until > 6
    
    # Cancel booking
    await db.bookings.update_one(
        {'booking_id': booking_id},
        {'$set': {'status': 'cancelled', 'cancelled_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update slot
    await db.slots.update_one(
        {'slot_id': booking_doc['slot_id']},
        {'$inc': {'current_bookings': -1}}
    )
    
    # Refund credits if applicable
    if refund_credits:
        await db.users.update_one(
            {'user_id': current_user.user_id},
            {'$inc': {'credits': booking_doc['credits_cost']}}
        )
    
    # Send cancellation email
    html = f"""
    <h2>Reserva Cancelada - Spark Fit</h2>
    <p>Hola {current_user.name},</p>
    <p>Tu reserva ha sido cancelada:</p>
    <ul>
        <li><strong>Actividad:</strong> {booking_doc['activity_type'].title()}</li>
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

# ==================== ROOT ENDPOINT ====================

@api_router.get('/')
async def root():
    return {'message': 'Spark Fit API v1.0'}

# Include router and middleware
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
