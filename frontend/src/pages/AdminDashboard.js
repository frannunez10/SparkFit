import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { LogOut, Calendar, CreditCard, Users, Settings, ChevronLeft, ChevronRight, Trash2, Check, X, Key, Search } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(location.state?.user || null);
  const [loading, setLoading] = useState(!user);
  
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activityConfigs, setActivityConfigs] = useState([]);
  const [scheduleOverrides, setScheduleOverrides] = useState([]);
  const [weeklySchedules, setWeeklySchedules] = useState([]);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [daySchedule, setDaySchedule] = useState(null);
  
  const [showAssignCredits, setShowAssignCredits] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [creditAssignment, setCreditAssignment] = useState({ credits: 0, reason: '' });
  
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideType, setOverrideType] = useState('date');
  const [overrideData, setOverrideData] = useState({ 
    date: '', 
    day_of_week: 0,
    is_closed: false, 
    custom_hours: [] 
  });
  const [customHourInput, setCustomHourInput] = useState({ start: 6, end: 22 });

  useEffect(() => {
    if (!user) {
      checkAuth();
    } else {
      if (user.role !== 'admin') {
        toast.error('Acceso denegado');
        navigate('/dashboard');
        return;
      }
      loadData();
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadDaySchedule();
    }
  }, [selectedDate]);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      if (response.data.role !== 'admin') {
        toast.error('Acceso denegado');
        navigate('/dashboard');
        return;
      }
      setUser(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Debes iniciar sesión');
      navigate('/login');
    }
  };

  const loadData = async () => {
    try {
      const [usersRes, bookingsRes, configsRes, overridesRes, weeklyRes] = await Promise.all([
        axios.get(`${API}/admin/users`, { withCredentials: true }),
        axios.get(`${API}/admin/bookings`, { withCredentials: true }),
        axios.get(`${API}/admin/config/activities`, { withCredentials: true }),
        axios.get(`${API}/admin/schedule-overrides`, { withCredentials: true }),
        axios.get(`${API}/admin/weekly-schedules`, { withCredentials: true })
      ]);
      setUsers(usersRes.data);
      setBookings(bookingsRes.data);
      setActivityConfigs(configsRes.data);
      setScheduleOverrides(overridesRes.data);
      setWeeklySchedules(weeklyRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
    }
  };

  const loadDaySchedule = async () => {
    try {
      const dateStr = formatDateForAPI(selectedDate);
      const response = await axios.get(`${API}/admin/calendar-day?date=${dateStr}`, { withCredentials: true });
      setDaySchedule(response.data);
    } catch (error) {
      console.error('Error loading day schedule:', error);
    }
  };

  const formatDateForAPI = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      toast.success('Sesión cerrada');
      navigate('/');
    } catch (error) {
      toast.error('Error al cerrar sesión');
    }
  };

  const handleAssignCredits = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    try {
      await axios.post(`${API}/admin/credits`, {
        user_id: selectedUser.user_id,
        credits: parseInt(creditAssignment.credits),
        reason: creditAssignment.reason
      }, { withCredentials: true });
      
      toast.success('Créditos asignados');
      setShowAssignCredits(false);
      setSelectedUser(null);
      setCreditAssignment({ credits: 0, reason: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al asignar créditos');
    }
  };

  const handleUpdateActivityConfig = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/admin/config/activity`, editingActivity, { withCredentials: true });
      toast.success('Configuración actualizada');
      setShowConfigModal(false);
      setEditingActivity(null);
      loadData();
    } catch (error) {
      toast.error('Error al actualizar configuración');
    }
  };

  const generateHoursArray = () => {
    const hours = [];
    for (let i = customHourInput.start; i < customHourInput.end; i++) {
      hours.push(i);
    }
    return hours;
  };

  const handleCreateOverride = async (e) => {
    e.preventDefault();
    try {
      const hours = overrideData.is_closed ? null : generateHoursArray();
      
      if (overrideType === 'date') {
        await axios.post(`${API}/admin/schedule-override`, {
          date: overrideData.date,
          is_closed: overrideData.is_closed,
          custom_hours: hours
        }, { withCredentials: true });
        toast.success(overrideData.is_closed ? 'Día cerrado' : 'Horario modificado');
      } else {
        await axios.post(`${API}/admin/weekly-schedule`, {
          day_of_week: overrideData.day_of_week,
          is_closed: overrideData.is_closed,
          custom_hours: hours
        }, { withCredentials: true });
        const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        toast.success(`Configurado para todos los ${dayNames[overrideData.day_of_week]}`);
      }
      
      setShowOverrideModal(false);
      setOverrideData({ date: '', day_of_week: 0, is_closed: false, custom_hours: [] });
      setCustomHourInput({ start: 6, end: 22 });
      loadData();
    } catch (error) {
      toast.error('Error al modificar horario');
    }
  };

  const handleDeleteOverride = async (date) => {
    if (!confirm('¿Restaurar horario normal para esta fecha?')) return;
    try {
      await axios.delete(`${API}/admin/schedule-override/${date}`, { withCredentials: true });
      toast.success('Horario restablecido');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar override');
    }
  };

  const handleDeleteWeeklySchedule = async (dayOfWeek) => {
    if (!confirm('¿Restaurar horario normal para este día?')) return;
    try {
      await axios.delete(`${API}/admin/weekly-schedule/${dayOfWeek}`, { withCredentials: true });
      toast.success('Horario restablecido');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar configuración');
    }
  };

  const handleMarkAttendance = async (bookingId, status) => {
    try {
      await axios.post(`${API}/admin/attendance`, {
        booking_id: bookingId,
        status: status
      }, { withCredentials: true });
      toast.success(status === 'attended' ? 'Marcado como asistió' : 'Marcado como ausente');
      loadData();
      loadDaySchedule();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al marcar asistencia');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordUser || !newPassword) return;
    
    try {
      await axios.post(`${API}/admin/change-password`, {
        user_id: passwordUser.user_id,
        new_password: newPassword
      }, { withCredentials: true });
      
      toast.success('Contraseña actualizada');
      setShowPasswordModal(false);
      setPasswordUser(null);
      setNewPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cambiar contraseña');
    }
  };

  const getActivityLabel = (activity) => {
    const labels = {
      entrenamiento: 'Entrenamiento',
      rehabilitacion: 'Rehabilitación',
      nutricion: 'Nutrición'
    };
    return labels[activity] || activity;
  };

  const getActivityColor = (activity) => {
    const colors = {
      entrenamiento: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      rehabilitacion: 'bg-green-500/20 text-green-400 border-green-500/30',
      nutricion: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    };
    return colors[activity] || 'bg-blue-500/20 text-blue-400';
  };

  const getStatusLabel = (status) => {
    const labels = {
      confirmed: 'Confirmada',
      cancelled: 'Cancelada',
      attended: 'Asistió',
      absent: 'Ausente'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      confirmed: 'bg-primary/20 text-primary',
      cancelled: 'bg-white/5 text-white/40',
      attended: 'bg-green-500/20 text-green-400',
      absent: 'bg-red-500/20 text-red-400'
    };
    return colors[status] || 'bg-white/5 text-white/40';
  };

  const previousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const nextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-zinc-900/50 border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-barlow text-2xl font-bold text-white uppercase">Panel de Administración</h1>
            <p className="text-white/60 text-sm">Bienvenido, {user?.name}</p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="border-white/20 hover:bg-white/10">
            <LogOut className="w-4 h-4 mr-2" />
            Salir
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Usuarios</p>
                <p className="font-barlow text-4xl font-bold text-white">{users.length}</p>
              </div>
              <Users className="w-12 h-12 text-primary opacity-50" />
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Reservas Activas</p>
                <p className="font-barlow text-4xl font-bold text-white">
                  {bookings.filter(b => b.status === 'confirmed').length}
                </p>
              </div>
              <Calendar className="w-12 h-12 text-primary opacity-50" />
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Clientes</p>
                <p className="font-barlow text-4xl font-bold text-white">
                  {users.filter(u => u.role === 'client').length}
                </p>
              </div>
              <Users className="w-12 h-12 text-primary opacity-50" />
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Total Reservas</p>
                <p className="font-barlow text-4xl font-bold text-white">{bookings.length}</p>
              </div>
              <Calendar className="w-12 h-12 text-primary opacity-50" />
            </div>
          </div>
        </div>

        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="bg-zinc-900 mb-6">
            <TabsTrigger value="calendar" className="data-[state=active]:bg-primary">Itinerario del Día</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary">Usuarios</TabsTrigger>
            <TabsTrigger value="bookings" className="data-[state=active]:bg-primary">Reservas</TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-primary">Configuración</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <div className="glass-card p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-barlow text-2xl font-bold text-white uppercase">Itinerario del Día</h2>
                <div className="flex items-center space-x-4">
                  <Button onClick={previousDay} variant="ghost" size="sm" className="text-white">
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <span className="text-white font-bold text-lg">
                    {selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                  <Button onClick={nextDay} variant="ghost" size="sm" className="text-white">
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {daySchedule?.is_closed ? (
                <div className="text-center py-12">
                  <p className="text-white/60 text-xl">Este día está cerrado</p>
                </div>
              ) : daySchedule?.schedule ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {daySchedule.schedule.map((slot, index) => (
                    <div key={index} className="glass-card p-4 border border-white/10">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-barlow text-2xl font-bold text-primary">{slot.time}</h3>
                        <span className={`text-sm font-semibold ${
                          slot.total_bookings >= slot.max_capacity 
                            ? 'text-red-400' 
                            : 'text-green-400'
                        }`}>
                          {slot.total_bookings}/{slot.max_capacity}
                        </span>
                      </div>
                      
                      {slot.bookings.length === 0 ? (
                        <p className="text-white/40 text-sm italic">Sin reservas</p>
                      ) : (
                        <div className="space-y-2">
                          {slot.bookings.map((booking, idx) => (
                            <div 
                              key={idx} 
                              className="bg-zinc-950/50 p-3 rounded border-l-4"
                              style={{ borderLeftColor: booking.activity_type === 'entrenamiento' ? '#2563EB' : booking.activity_type === 'rehabilitacion' ? '#10B981' : '#F59E0B' }}
                            >
                              <p className="text-white font-bold text-sm">{booking.user?.name}</p>
                              <p className="text-white/60 text-xs mt-1">{getActivityLabel(booking.activity_type)}</p>
                              <div className="flex items-center justify-between mt-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(booking.status)}`}>
                                  {getStatusLabel(booking.status)}
                                </span>
                                {booking.status === 'confirmed' && (
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => handleMarkAttendance(booking.booking_id, 'attended')}
                                      className="p-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                      title="Marcar asistencia"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleMarkAttendance(booking.booking_id, 'absent')}
                                      className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                      title="Marcar ausente"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="glass-card p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-barlow text-2xl font-bold text-white uppercase">Gestión de Usuarios</h2>
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <Input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 pl-10 h-10"
                  />
                </div>
              </div>
              <div className="space-y-4">
                {users
                  .filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                               u.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
                  .map((u) => (
                  <div key={u.user_id} className="border border-white/5 p-4 flex justify-between items-center">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-white font-bold">{u.name}</p>
                        <p className="text-white/60 text-sm">{u.email}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                            u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {u.role}
                          </span>
                          <span className="text-primary font-bold">{u.credits} créditos</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => {
                          setSelectedUser(u);
                          setShowAssignCredits(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="border-primary/20 text-primary hover:bg-primary/10"
                      >
                        <CreditCard className="w-4 h-4 mr-1" />
                        Créditos
                      </Button>
                      <Button
                        onClick={() => {
                          setPasswordUser(u);
                          setNewPassword('');
                          setShowPasswordModal(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/10"
                      >
                        <Key className="w-4 h-4 mr-1" />
                        Contraseña
                      </Button>
                    </div>
                  </div>
                ))}
                {users.filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                               u.email.toLowerCase().includes(userSearchQuery.toLowerCase())).length === 0 && (
                  <p className="text-white/60 text-center py-8">No se encontraron usuarios con "{userSearchQuery}"</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bookings">
            <div className="glass-card p-6">
              <h2 className="font-barlow text-2xl font-bold text-white uppercase mb-6">Todas las Reservas</h2>
              <div className="space-y-4">
                {bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((booking) => (
                  <div key={booking.booking_id} className={`border border-white/5 p-4 ${booking.status === 'cancelled' ? 'opacity-50' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={`px-3 py-1 rounded text-xs font-semibold uppercase border ${getActivityColor(booking.activity_type)}`}>
                            {getActivityLabel(booking.activity_type)}
                          </div>
                          <span className={`px-3 py-1 rounded text-xs font-semibold uppercase ${getStatusColor(booking.status)}`}>
                            {getStatusLabel(booking.status)}
                          </span>
                        </div>
                        <p className="text-white font-bold">{booking.date} - {booking.time}</p>
                        {booking.user && (
                          <p className="text-white/60 text-sm mt-1">
                            Cliente: {booking.user.name} ({booking.user.email})
                          </p>
                        )}
                      </div>
                      {booking.status === 'confirmed' && (
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => handleMarkAttendance(booking.booking_id, 'attended')}
                            variant="outline"
                            size="sm"
                            className="border-green-500/20 text-green-400 hover:bg-green-500/10"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Asistió
                          </Button>
                          <Button
                            onClick={() => handleMarkAttendance(booking.booking_id, 'absent')}
                            variant="outline"
                            size="sm"
                            className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Ausente
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="config">
            <div className="space-y-6">
              <div className="glass-card p-6">
                <h2 className="font-barlow text-2xl font-bold text-white uppercase mb-6">Configuración de Precios</h2>
                <div className="space-y-4">
                  {activityConfigs.map((config) => (
                    <div key={config.activity_type} className="border border-white/5 p-4 flex justify-between items-center">
                      <div>
                        <p className="text-white font-bold uppercase">{getActivityLabel(config.activity_type)}</p>
                        <p className="text-white/60 text-sm">Costo: {config.credits_cost} créditos | Capacidad: {config.max_capacity}</p>
                      </div>
                      <Button
                        onClick={() => {
                          setEditingActivity(config);
                          setShowConfigModal(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="border-primary/20 text-primary"
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-barlow text-2xl font-bold text-white uppercase">Gestión de Horarios</h2>
                  <Button onClick={() => {
                    setOverrideType('date');
                    setShowOverrideModal(true);
                  }} className="bg-primary">
                    Modificar Horario
                  </Button>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-white font-bold mb-3">Configuración Semanal (Recurrente)</h3>
                    <div className="space-y-2">
                      {weeklySchedules.map((schedule) => (
                        <div key={schedule.day_of_week} className="border border-white/5 p-3 flex justify-between items-center">
                          <div>
                            <p className="text-white font-bold">{dayNames[schedule.day_of_week]}</p>
                            <p className="text-white/60 text-sm">
                              {schedule.is_closed ? 'Cerrado' : schedule.custom_hours ? `Horario: ${schedule.custom_hours[0]}:00 - ${schedule.custom_hours[schedule.custom_hours.length - 1] + 1}:00` : 'Horario normal'}
                            </p>
                          </div>
                          <Button
                            onClick={() => handleDeleteWeeklySchedule(schedule.day_of_week)}
                            variant="outline"
                            size="sm"
                            className="border-red-500/20 text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {weeklySchedules.length === 0 && (
                        <p className="text-white/60 text-sm italic">Sin configuración semanal personalizada</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-white font-bold mb-3">Fechas Específicas</h3>
                    <div className="space-y-2">
                      {scheduleOverrides.map((override) => (
                        <div key={override.date} className="border border-white/5 p-3 flex justify-between items-center">
                          <div>
                            <p className="text-white font-bold">{override.date}</p>
                            <p className="text-white/60 text-sm">
                              {override.is_closed ? 'Cerrado' : override.custom_hours ? `Horario: ${override.custom_hours[0]}:00 - ${override.custom_hours[override.custom_hours.length - 1] + 1}:00` : 'Modificado'}
                            </p>
                          </div>
                          <Button
                            onClick={() => handleDeleteOverride(override.date)}
                            variant="outline"
                            size="sm"
                            className="border-red-500/20 text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {scheduleOverrides.length === 0 && (
                        <p className="text-white/60 text-sm italic">Sin modificaciones de fechas específicas</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showAssignCredits} onOpenChange={setShowAssignCredits}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="font-barlow text-2xl uppercase">Asignar Créditos</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <form onSubmit={handleAssignCredits} className="space-y-4">
              <p className="text-white/60">Usuario: {selectedUser.name} | Créditos actuales: {selectedUser.credits}</p>
              <div>
                <Label htmlFor="credits" className="text-white mb-2 block">Créditos (+ agregar / - quitar)</Label>
                <Input
                  id="credits"
                  type="number"
                  value={creditAssignment.credits}
                  onChange={(e) => setCreditAssignment({ ...creditAssignment, credits: e.target.value })}
                  required
                  className="bg-zinc-950 border-zinc-800 h-12"
                />
              </div>
              <div>
                <Label htmlFor="reason" className="text-white mb-2 block">Motivo</Label>
                <Input
                  id="reason"
                  type="text"
                  value={creditAssignment.reason}
                  onChange={(e) => setCreditAssignment({ ...creditAssignment, reason: e.target.value })}
                  required
                  className="bg-zinc-950 border-zinc-800 h-12"
                />
              </div>
              <div className="flex space-x-3">
                <Button type="submit" className="flex-1 bg-primary">Asignar</Button>
                <Button type="button" onClick={() => setShowAssignCredits(false)} variant="outline" className="flex-1 border-white/20">Cancelar</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="font-barlow text-2xl uppercase">Configurar Actividad</DialogTitle>
          </DialogHeader>
          {editingActivity && (
            <form onSubmit={handleUpdateActivityConfig} className="space-y-4">
              <p className="text-white font-bold uppercase">{getActivityLabel(editingActivity.activity_type)}</p>
              <div>
                <Label htmlFor="credits_cost" className="text-white mb-2 block">Costo en Créditos</Label>
                <Input
                  id="credits_cost"
                  type="number"
                  min="1"
                  value={editingActivity.credits_cost}
                  onChange={(e) => setEditingActivity({ ...editingActivity, credits_cost: parseInt(e.target.value) })}
                  required
                  className="bg-zinc-950 border-zinc-800 h-12"
                />
              </div>
              <div>
                <Label htmlFor="max_capacity" className="text-white mb-2 block">Capacidad Máxima</Label>
                <Input
                  id="max_capacity"
                  type="number"
                  min="1"
                  value={editingActivity.max_capacity}
                  onChange={(e) => setEditingActivity({ ...editingActivity, max_capacity: parseInt(e.target.value) })}
                  required
                  className="bg-zinc-950 border-zinc-800 h-12"
                />
              </div>
              <div className="flex space-x-3">
                <Button type="submit" className="flex-1 bg-primary">Guardar</Button>
                <Button type="button" onClick={() => setShowConfigModal(false)} variant="outline" className="flex-1 border-white/20">Cancelar</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showOverrideModal} onOpenChange={setShowOverrideModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-barlow text-2xl uppercase">Modificar Horario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOverride} className="space-y-4">
            <div>
              <Label className="text-white mb-2 block">Tipo de Modificación</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setOverrideType('date')}
                  className={`p-4 rounded-lg border transition-all ${
                    overrideType === 'date' 
                      ? 'bg-primary/20 border-primary' 
                      : 'bg-zinc-800/50 border-white/10 hover:border-primary/50'
                  }`}
                >
                  <p className="text-white font-bold">Fecha Específica</p>
                  <p className="text-white/60 text-xs mt-1">Ej: Feriado</p>
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideType('weekly')}
                  className={`p-4 rounded-lg border transition-all ${
                    overrideType === 'weekly' 
                      ? 'bg-primary/20 border-primary' 
                      : 'bg-zinc-800/50 border-white/10 hover:border-primary/50'
                  }`}
                >
                  <p className="text-white font-bold">Día de Semana</p>
                  <p className="text-white/60 text-xs mt-1">Recurrente</p>
                </button>
              </div>
            </div>

            {overrideType === 'date' ? (
              <div>
                <Label htmlFor="override_date" className="text-white mb-2 block">Fecha</Label>
                <Input
                  id="override_date"
                  type="date"
                  value={overrideData.date}
                  onChange={(e) => setOverrideData({ ...overrideData, date: e.target.value })}
                  required
                  className="bg-zinc-950 border-zinc-800 h-12"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="day_of_week" className="text-white mb-2 block">Día de la Semana</Label>
                <Select 
                  value={String(overrideData.day_of_week)} 
                  onValueChange={(value) => setOverrideData({ ...overrideData, day_of_week: parseInt(value) })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {dayNames.map((name, idx) => (
                      <SelectItem key={idx} value={String(idx)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                id="is_closed"
                type="checkbox"
                checked={overrideData.is_closed}
                onChange={(e) => setOverrideData({ ...overrideData, is_closed: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="is_closed" className="text-white">Cerrar este día</Label>
            </div>

            {!overrideData.is_closed && (
              <div>
                <Label className="text-white mb-2 block">Horario de Apertura</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_hour" className="text-white/60 text-sm mb-1 block">Apertura</Label>
                    <Input
                      id="start_hour"
                      type="number"
                      min="0"
                      max="23"
                      value={customHourInput.start}
                      onChange={(e) => setCustomHourInput({ ...customHourInput, start: parseInt(e.target.value) })}
                      className="bg-zinc-950 border-zinc-800 h-12"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_hour" className="text-white/60 text-sm mb-1 block">Cierre</Label>
                    <Input
                      id="end_hour"
                      type="number"
                      min="0"
                      max="23"
                      value={customHourInput.end}
                      onChange={(e) => setCustomHourInput({ ...customHourInput, end: parseInt(e.target.value) })}
                      className="bg-zinc-950 border-zinc-800 h-12"
                    />
                  </div>
                </div>
                <p className="text-white/60 text-xs mt-2">
                  Horario: {customHourInput.start}:00 - {customHourInput.end}:00
                </p>
              </div>
            )}

            <div className="flex space-x-3">
              <Button type="submit" className="flex-1 bg-primary">Guardar</Button>
              <Button type="button" onClick={() => setShowOverrideModal(false)} variant="outline" className="flex-1 border-white/20">Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="font-barlow text-2xl uppercase">Cambiar Contraseña</DialogTitle>
          </DialogHeader>
          {passwordUser && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <p className="text-white/60">Usuario: {passwordUser.name} ({passwordUser.email})</p>
              <div>
                <Label htmlFor="new_password" className="text-white mb-2 block">Nueva Contraseña</Label>
                <Input
                  id="new_password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="bg-zinc-950 border-zinc-800 h-12"
                />
              </div>
              <div className="flex space-x-3">
                <Button type="submit" className="flex-1 bg-primary">Cambiar</Button>
                <Button type="button" onClick={() => setShowPasswordModal(false)} variant="outline" className="flex-1 border-white/20">Cancelar</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
