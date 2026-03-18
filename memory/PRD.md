# Spark Fit - Product Requirements Document

## Original Problem Statement
Sitio web moderno y elegante para un centro de entrenamiento llamado "Spark Fit". El sitio debe tener una página institucional y un sistema completo de gestión de turnos basado en créditos.

## User Personas
- **Administrador (3):** Gestiona calendario, crea/edita/cancela turnos, define cupos (máximo 5 por hora en total), gestiona créditos de usuarios.
- **Cliente:** Se registra/loguea, ve calendario, reserva/cancela turnos, ve su saldo de créditos e historial.

## Core Requirements
- **Identidad de Marca:** Estilo fitness premium, colores negro, blanco, gris con acentos en azul eléctrico.
- **Sistema de Turnos:** Basado en calendario con créditos. Máximo 5 personas por hora (total, no por actividad).
- **Horarios:**
  - Entrenamiento/Rehabilitación: Lunes a Viernes de 06:00 a 13:00 y de 15:00 a 22:00.
  - Nutrición: Martes, Jueves y Sábados a las 10:00, 11:00 y 12:00.
- **Reservas:** Se habilitan con una semana de antelación. Mínimo 1 hora de anticipación.
- **Cancelaciones:** Devolución de créditos si se cancela con >6 horas de antelación.
- **Autenticación:** Email/contraseña con opción "ver contraseña" y Google Social Login.

## Tech Stack
- **Backend:** FastAPI + MongoDB (motor async)
- **Frontend:** React + TailwindCSS + Shadcn/UI
- **Auth:** JWT + Emergent Google OAuth

## What's Been Implemented

### Core Features (Completed)
- [x] Landing page institucional
- [x] Sistema de autenticación (JWT + Google OAuth)
- [x] Dashboard de cliente con flujo de reserva de 3 pasos (fecha → hora → actividad)
- [x] Sistema de créditos
- [x] Panel de administración completo con:
  - Itinerario visual del día
  - Gestión de usuarios
  - Gestión de créditos
  - Configuración de precios por actividad
  - Gestión de horarios (días específicos y semanales recurrentes)

### New Features (2026-03-18)
- [x] **Historial de reservas con estados:** Asistió (verde), Ausente (rojo), Cancelada (gris), Confirmada (azul)
- [x] **Marcar asistencia desde Admin:** Botones "Asistió" y "Ausente" en reservas confirmadas
- [x] **"¿Olvidaste tu contraseña?":** Link en login que redirige a WhatsApp con mensaje predefinido
- [x] **Admin cambia contraseña:** Botón "Contraseña" en lista de usuarios para cambiar contraseña de cualquier cliente
- [x] **Buscador de usuarios:** Campo de búsqueda en sección Usuarios para filtrar por nombre o email

## API Endpoints
### Auth
- `POST /api/auth/login` - Login con email/contraseña
- `POST /api/auth/register` - Registro de nuevo usuario
- `GET /api/auth/google/login` - Inicio de Google OAuth
- `POST /api/auth/google-session` - Completar Google OAuth
- `GET /api/auth/me` - Usuario actual
- `POST /api/auth/logout` - Cerrar sesión

### Client
- `GET /api/calendar/available-slots?date=YYYY-MM-DD` - Slots disponibles
- `POST /api/bookings` - Crear reserva
- `GET /api/bookings/my` - Mis reservas
- `DELETE /api/bookings/{booking_id}` - Cancelar reserva

### Admin
- `GET /api/admin/calendar-day?date=YYYY-MM-DD` - Itinerario del día
- `GET /api/admin/users` - Lista de usuarios
- `POST /api/admin/credits` - Asignar créditos
- `POST /api/admin/attendance` - Marcar asistencia (attended/absent)
- `POST /api/admin/change-password` - Cambiar contraseña de usuario
- `GET/POST /api/admin/config/activities` - Configuración de actividades
- `GET/POST/DELETE /api/admin/schedule-override` - Horarios de fechas específicas
- `GET/POST/DELETE /api/admin/weekly-schedule` - Horarios semanales recurrentes
- `GET /api/admin/bookings` - Todas las reservas

## Database Schema
- `users`: {user_id, email, password_hash, name, role, credits, picture, google_id, created_at}
- `bookings`: {booking_id, user_id, date, time, activity_type, credits_cost, status, created_at, cancelled_at, marked_at}
- `activity_config`: {activity_type, credits_cost, max_capacity}
- `schedule_overrides`: {date, is_closed, custom_hours}
- `weekly_schedule`: {day_of_week, is_closed, custom_hours}
- `credit_transactions`: {transaction_id, user_id, credits, reason, admin_id, created_at}
- `user_sessions`: {user_id, session_token, expires_at, created_at}

## Credentials
- **Admin:** AdministracionGimnasio1@gmail.com / AdministracionGimnasio1.2026
- **Client test:** cliente@test.com / cliente123
- **WhatsApp:** +5492617462186

## Backlog / Future Tasks
- [ ] Página institucional adicional (Sobre Nosotros, Servicios, Contacto)
- [ ] Mejoras de diseño según feedback del usuario
- [ ] Estadísticas y reportes para admin
