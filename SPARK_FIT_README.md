# Spark Fit - Centro de Entrenamientos

Sitio web moderno y completo para gestión de turnos de un centro de fitness premium.

## 🚀 Características Principales

### Landing Page Institucional
- Hero section impactante con mensaje motivacional
- Sección de servicios (Entrenamiento, One-to-One, Nutrición, Rehabilitación)
- Información sobre el centro
- Horarios detallados
- Contacto (WhatsApp e Instagram)

### Sistema de Autenticación
- **Autenticación dual**: Login/Registro con email/contraseña (JWT) + Google OAuth
- Roles: Cliente y Administrador
- Sesiones persistentes con cookies httpOnly

### Panel de Cliente
- Visualización de créditos disponibles
- **Nuevo flujo de reserva en 3 pasos**:
  1. Seleccionar fecha en calendario personalizado (máximo 1 semana de anticipación)
  2. Seleccionar horario disponible (huecos llenos aparecen deshabilitados en color oscuro)
  3. Seleccionar actividad disponible para ese horario
- Cancelar turnos con política de 6 horas:
  - Cancelación >6h: devuelve créditos
  - Cancelación <6h: NO devuelve créditos
- Historial de reservas (activas y canceladas)
- **Cupos internos**: El sistema controla ocupación pero no muestra números al cliente

### Panel de Administración
- Crear/eliminar turnos con:
  - Tipo de actividad (entrenamiento, rehabilitación, nutrición)
  - Fecha y hora
  - Capacidad máxima (hasta 5 personas por defecto)
  - Costo en créditos (configurable)
- Ver todas las reservas del sistema
- Gestión de usuarios
- Asignar/quitar créditos a usuarios con motivo registrado

### Sistema de Créditos
- Los créditos son asignados manualmente por administradores
- Cada turno consume créditos según su configuración
- Registro de transacciones de créditos

### Notificaciones por Email
- Confirmación de reserva
- Notificación de cancelación
- Integración con Resend

## 🎨 Diseño

- **Colores**: Negro (#09090B), blanco, gris + azul eléctrico (#2563EB)
- **Tipografía**: Barlow Condensed (headings) + Manrope (body)
- **Estilo**: Dark mode, minimalista, impactante, fitness premium
- **UI Components**: Shadcn/UI + Tailwind CSS
- **Animaciones**: Framer Motion

## 🔑 Credenciales de Acceso

### Administradores (3 pre-configurados)
```
Email: AdministracionGimnasio1@gmail.com
Password: AdministracionGimnasio1.2026

Email: AdministracionGimnasio2@gmail.com
Password: AdministracionGimnasio2.2026

Email: AdministracionGimnasio3@gmail.com
Password: AdministracionGimnasio3.2026
```

### Cliente de Prueba
```
Email: cliente@test.com
Password: cliente123
Créditos: 10
```

## 📋 Horarios y Reglas del Negocio

### Entrenamiento y Rehabilitación
- **Días**: Lunes a Viernes
- **Horarios**: 
  - Mañana: 06:00 - 10:00
  - Tarde: 17:00 - 21:00
- **Duración**: 1 hora por sesión
- **Capacidad**: Máximo 5 personas por turno

### Nutrición
- **Días**: Martes, Jueves y Sábados
- **Horarios**: 10:00, 11:00, 12:00
- **Duración**: 1 hora
- **Capacidad**: 1 persona (consulta individual)

### Reglas de Reserva
- **Anticipación máxima**: 1 semana (7 días)
- **Política de cancelación**: 
  - Más de 6 horas antes: devuelve créditos
  - Menos de 6 horas: NO devuelve créditos
- **Cupos**: El sistema controla ocupación internamente pero no muestra números específicos al cliente

## 🛠️ Tecnologías

### Backend
- FastAPI
- MongoDB (Motor - async driver)
- JWT + Google OAuth (Emergent Auth)
- Resend (emails)
- bcrypt (hashing de contraseñas)

### Frontend
- React 19
- React Router v7
- Tailwind CSS
- Shadcn/UI
- Framer Motion
- React Big Calendar
- Axios
- Sonner (toasts)

## 📊 Estructura de la Base de Datos

### Collections

#### users
```json
{
  "user_id": "user_abc123",
  "email": "usuario@email.com",
  "password": "hashed_password",
  "name": "Nombre Usuario",
  "role": "client|admin",
  "credits": 10,
  "picture": "url_opcional",
  "phone": "opcional",
  "created_at": "ISO_timestamp"
}
```

#### user_sessions (Google OAuth)
```json
{
  "user_id": "user_abc123",
  "session_token": "token_abc",
  "expires_at": "ISO_timestamp",
  "created_at": "ISO_timestamp"
}
```

#### slots
```json
{
  "slot_id": "slot_abc123",
  "activity_type": "entrenamiento|rehabilitacion|nutricion",
  "date": "2026-03-20",
  "time": "08:00",
  "max_capacity": 5,
  "current_bookings": 2,
  "credits_cost": 1,
  "created_at": "ISO_timestamp"
}
```

#### bookings
```json
{
  "booking_id": "booking_abc123",
  "user_id": "user_abc123",
  "slot_id": "slot_abc123",
  "activity_type": "entrenamiento",
  "date": "2026-03-20",
  "time": "08:00",
  "credits_cost": 1,
  "status": "confirmed|cancelled",
  "created_at": "ISO_timestamp",
  "cancelled_at": "ISO_timestamp_opcional"
}
```

#### credit_transactions
```json
{
  "transaction_id": "txn_abc123",
  "user_id": "user_abc123",
  "credits": 10,
  "reason": "Compra paquete mensual",
  "admin_id": "admin_abc123",
  "created_at": "ISO_timestamp"
}
```

## 🔗 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login con email/password
- `POST /api/auth/google-session` - Login con Google OAuth
- `GET /api/auth/me` - Obtener usuario actual
- `POST /api/auth/logout` - Cerrar sesión

### Cliente
- `GET /api/calendar/available` - Turnos disponibles (query: date, activity_type)
- `POST /api/bookings` - Crear reserva
- `GET /api/bookings/my` - Mis reservas
- `DELETE /api/bookings/{booking_id}` - Cancelar reserva

### Administrador
- `POST /api/admin/slots` - Crear turno
- `GET /api/admin/slots` - Listar todos los turnos
- `DELETE /api/admin/slots/{slot_id}` - Eliminar turno
- `GET /api/admin/users` - Listar usuarios
- `POST /api/admin/credits` - Asignar créditos
- `GET /api/admin/bookings` - Ver todas las reservas

## 🎯 Flujos Principales

### Flujo de Reserva (Cliente) - 3 Pasos
1. **Paso 1 - Seleccionar Fecha:**
   - Cliente ve calendario personalizado del mes actual
   - Día actual resaltado en azul
   - Días pasados y más allá de 7 días deshabilitados
   - Solo puede seleccionar fechas dentro de la próxima semana
   
2. **Paso 2 - Seleccionar Horario:**
   - Sistema muestra horarios disponibles para la fecha elegida
   - Horarios totalmente ocupados aparecen en color oscuro y deshabilitados
   - Horarios con disponibilidad son clickeables
   
3. **Paso 3 - Seleccionar Actividad:**
   - Muestra solo actividades disponibles para ese horario específico
   - Valida automáticamente los horarios permitidos por tipo de actividad:
     - Entrenamiento/Rehabilitación: L-V 6-10am, 5-9pm
     - Nutrición: Ma-Ju-Sa 10am, 11am, 12pm
   - Muestra costo en créditos
   - Cliente confirma la reserva
   
4. **Confirmación:**
   - Sistema verifica créditos disponibles
   - Se descuentan los créditos
   - Se incrementa el contador de reservas del turno
   - Se envía email de confirmación
   - Reserva aparece en "Mis Reservas"

### Flujo de Cancelación (Cliente)
1. Cliente ve sus reservas activas
2. Selecciona "Cancelar" en una reserva
3. Sistema calcula tiempo hasta el turno
4. Si >6h: devuelve créditos
5. Si <6h: NO devuelve créditos
6. Se actualiza estado a "cancelada"
7. Se decrementa contador del turno
8. Se envía email de cancelación

### Flujo de Gestión (Admin)
1. Admin inicia sesión
2. Accede al panel de administración
3. Puede:
   - Crear nuevos turnos con configuración personalizada
   - Ver todas las reservas del sistema
   - Gestionar usuarios
   - Asignar/quitar créditos a usuarios
   - Eliminar turnos (cancela todas las reservas asociadas automáticamente)

## 🌐 Contacto del Negocio

- **Teléfono/WhatsApp**: +54 261 7462186
- **Instagram**: [@sspark.fit](https://www.instagram.com/sspark.fit)
- **Ubicación**: Mendoza, Argentina

## 📝 Notas Importantes

1. **MongoDB**: Todas las queries usan proyección `{"_id": 0}` para evitar problemas de serialización
2. **Google OAuth**: El redirect URL se construye dinámicamente usando `window.location.origin`
3. **Emails**: Requiere configurar `RESEND_API_KEY` en `/app/backend/.env` para envío de emails
4. **Horarios**: Los horarios de los turnos son validados contra las reglas del negocio
5. **Datos de ejemplo**: El sistema viene con 16 turnos de ejemplo para los próximos 5 días

## 🚀 Próximas Mejoras Sugeridas

- Notificaciones push para recordatorios de turnos
- Paquetes de créditos con diferentes precios
- Estadísticas y métricas para administradores
- Sistema de feedback post-entrenamiento
- Integración con calendario de Google
- App móvil nativa
- Sistema de referidos con bonificación de créditos
- Gamificación (badges por asistencia consecutiva)
