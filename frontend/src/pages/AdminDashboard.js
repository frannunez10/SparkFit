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
import { LogOut, Calendar, CreditCard, Users, Settings, ChevronLeft, ChevronRight } from 'lucide-react';

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
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [daySchedule, setDaySchedule] = useState(null);
  
  const [showAssignCredits, setShowAssignCredits] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [creditAssignment, setCreditAssignment] = useState({ credits: 0, reason: '' });
  
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideData, setOverrideData] = useState({ date: '', is_closed: false });

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
      const [usersRes, bookingsRes, configsRes, overridesRes] = await Promise.all([
        axios.get(`${API}/admin/users`, { withCredentials: true }),
        axios.get(`${API}/admin/bookings`, { withCredentials: true }),
        axios.get(`${API}/admin/config/activities`, { withCredentials: true }),
        axios.get(`${API}/admin/schedule-overrides`, { withCredentials: true })
      ]);
      setUsers(usersRes.data);
      setBookings(bookingsRes.data);
      setActivityConfigs(configsRes.data);
      setScheduleOverrides(overridesRes.data);
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

  const handleCreateOverride = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admin/schedule-override`, overrideData, { withCredentials: true });
      toast.success(overrideData.is_closed ? 'Día cerrado' : 'Horario modificado');
      setShowOverrideModal(false);
      setOverrideData({ date: '', is_closed: false });
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
            <TabsTrigger value="calendar" className="data-[state=active]:bg-primary">Calendario/Itinerario</TabsTrigger>
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
                  <span className="text-white font-bold">{selectedDate.toLocaleDateString('es-AR')}</span>
                  <Button onClick={nextDay} variant="ghost" size="sm" className="text-white">
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {daySchedule?.is_closed ? (
                <p className="text-white/60 text-center py-8">Este día está cerrado</p>
              ) : daySchedule?.schedule ? (
                <div className="space-y-4">
                  {daySchedule.schedule.map((slot, index) => (
                    <div key={index} className="border border-white/10 p-4 rounded-lg">
                      <h3 className="font-bold text-white text-lg mb-3">{slot.time}</h3>
                      <div className="space-y-2">
                        {slot.bookings.map((activityGroup, idx) => (
                          <div key={idx} className="bg-zinc-900/50 p-3 rounded">
                            <div className="flex justify-between items-center mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${getActivityColor(activityGroup.activity_type)}`}>
                                {getActivityLabel(activityGroup.activity_type)}
                              </span>
                              <span className="text-white/60 text-sm">
                                {activityGroup.current_bookings}/{activityGroup.max_capacity} cupos
                              </span>
                            </div>
                            {activityGroup.bookings_list.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {activityGroup.bookings_list.map((booking, bidx) => (
                                  <div key={bidx} className="text-sm text-white/70">
                                    • {booking.user?.name} ({booking.user?.email})
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/60 text-center py-8">Cargando...</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="glass-card p-6">
              <h2 className="font-barlow text-2xl font-bold text-white uppercase mb-6">Gestión de Usuarios</h2>
              <div className="space-y-4">
                {users.map((u, index) => (
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
                      Asignar Créditos
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bookings">
            <div className="glass-card p-6">
              <h2 className="font-barlow text-2xl font-bold text-white uppercase mb-6">Todas las Reservas</h2>
              <div className="space-y-4">
                {bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((booking, index) => (
                  <div key={booking.booking_id} className={`border border-white/5 p-4 ${booking.status === 'cancelled' ? 'opacity-50' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={`px-3 py-1 rounded text-xs font-semibold uppercase border ${getActivityColor(booking.activity_type)}`}>
                            {getActivityLabel(booking.activity_type)}
                          </div>
                          <span className={`px-3 py-1 rounded text-xs font-semibold uppercase ${
                            booking.status === 'confirmed' ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/40'
                          }`}>
                            {booking.status === 'confirmed' ? 'Confirmada' : 'Cancelada'}
                          </span>
                        </div>
                        <p className="text-white font-bold">{booking.date} - {booking.time}</p>
                        {booking.user && (
                          <p className="text-white/60 text-sm mt-1">
                            Cliente: {booking.user.name} ({booking.user.email})
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="config">
            <div className="space-y-6">
              <div className="glass-card p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-barlow text-2xl font-bold text-white uppercase">Configuración de Precios</h2>
                </div>
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
                  <Button onClick={() => setShowOverrideModal(true)} className="bg-primary">
                    Modificar Horario
                  </Button>
                </div>
                <div className="space-y-4">
                  {scheduleOverrides.map((override) => (
                    <div key={override.date} className="border border-white/5 p-4 flex justify-between items-center">
                      <div>
                        <p className="text-white font-bold">{override.date}</p>
                        <p className="text-white/60 text-sm">
                          {override.is_closed ? 'Cerrado' : 'Horario personalizado'}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleDeleteOverride(override.date)}
                        variant="outline"
                        size="sm"
                        className="border-red-500/20 text-red-400"
                      >
                        Restaurar
                      </Button>
                    </div>
                  ))}
                  {scheduleOverrides.length === 0 && (
                    <p className="text-white/60 text-center py-4">No hay modificaciones de horario</p>
                  )}
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
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="font-barlow text-2xl uppercase">Modificar Horario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOverride} className="space-y-4">
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
            <div className="flex space-x-3">
              <Button type="submit" className="flex-1 bg-primary">Guardar</Button>
              <Button type="button" onClick={() => setShowOverrideModal(false)} variant="outline" className="flex-1 border-white/20">Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
