import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { LogOut, Plus, Users, Calendar, CreditCard, Trash2, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(location.state?.user || null);
  const [loading, setLoading] = useState(!user);
  
  const [slots, setSlots] = useState([]);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  
  const [showCreateSlot, setShowCreateSlot] = useState(false);
  const [showAssignCredits, setShowAssignCredits] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [newSlot, setNewSlot] = useState({
    activity_type: 'entrenamiento',
    date: '',
    time: '',
    max_capacity: 5,
    credits_cost: 1
  });
  
  const [creditAssignment, setCreditAssignment] = useState({
    credits: 0,
    reason: ''
  });

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

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      if (response.data.role !== 'admin') {
        toast.error('Acceso denegado: se requiere rol de administrador');
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
      const [slotsRes, usersRes, bookingsRes] = await Promise.all([
        axios.get(`${API}/admin/slots`, { withCredentials: true }),
        axios.get(`${API}/admin/users`, { withCredentials: true }),
        axios.get(`${API}/admin/bookings`, { withCredentials: true })
      ]);
      setSlots(slotsRes.data);
      setUsers(usersRes.data);
      setBookings(bookingsRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
    }
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

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admin/slots`, newSlot, { withCredentials: true });
      toast.success('Turno creado exitosamente');
      setShowCreateSlot(false);
      setNewSlot({
        activity_type: 'entrenamiento',
        date: '',
        time: '',
        max_capacity: 5,
        credits_cost: 1
      });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear turno');
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('¿Estás seguro? Esto cancelará todas las reservas asociadas.')) return;
    
    try {
      await axios.delete(`${API}/admin/slots/${slotId}`, { withCredentials: true });
      toast.success('Turno eliminado');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar turno');
    }
  };

  const handleAssignCredits = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    try {
      await axios.post(
        `${API}/admin/credits`,
        {
          user_id: selectedUser.user_id,
          credits: parseInt(creditAssignment.credits),
          reason: creditAssignment.reason
        },
        { withCredentials: true }
      );
      toast.success('Créditos asignados exitosamente');
      setShowAssignCredits(false);
      setSelectedUser(null);
      setCreditAssignment({ credits: 0, reason: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al asignar créditos');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-spinner">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="admin-dashboard">
      {/* Header */}
      <header className="bg-zinc-900/50 border-b border-white/5 px-6 py-4" data-testid="admin-header">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-barlow text-2xl font-bold text-white uppercase" data-testid="admin-dashboard-title">
              Panel de Administración
            </h1>
            <p className="text-white/60 text-sm">Bienvenido, {user?.name}</p>
          </div>
          <Button 
            onClick={handleLogout} 
            variant="outline" 
            className="border-white/20 hover:bg-white/10"
            data-testid="admin-logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Salir
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="glass-card p-6" data-testid="stats-total-users">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Total Usuarios</p>
                <p className="font-barlow text-4xl font-bold text-white">{users.length}</p>
              </div>
              <Users className="w-12 h-12 text-primary opacity-50" />
            </div>
          </div>

          <div className="glass-card p-6" data-testid="stats-total-slots">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Turnos Creados</p>
                <p className="font-barlow text-4xl font-bold text-white">{slots.length}</p>
              </div>
              <Calendar className="w-12 h-12 text-primary opacity-50" />
            </div>
          </div>

          <div className="glass-card p-6" data-testid="stats-active-bookings">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Reservas Activas</p>
                <p className="font-barlow text-4xl font-bold text-white">
                  {bookings.filter(b => b.status === 'confirmed').length}
                </p>
              </div>
              <CreditCard className="w-12 h-12 text-primary opacity-50" />
            </div>
          </div>

          <div className="glass-card p-6" data-testid="stats-clients">
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
        </div>

        {/* Tabs */}
        <Tabs defaultValue="slots" className="w-full">
          <TabsList className="bg-zinc-900 mb-6">
            <TabsTrigger value="slots" className="data-[state=active]:bg-primary" data-testid="slots-tab">
              Turnos
            </TabsTrigger>
            <TabsTrigger value="bookings" className="data-[state=active]:bg-primary" data-testid="bookings-tab">
              Reservas
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary" data-testid="users-tab">
              Usuarios
            </TabsTrigger>
          </TabsList>

          {/* Slots Tab */}
          <TabsContent value="slots">
            <div className="glass-card p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-barlow text-2xl font-bold text-white uppercase">Gestión de Turnos</h2>
                <Button 
                  onClick={() => setShowCreateSlot(true)} 
                  className="bg-primary hover:bg-primary/90"
                  data-testid="create-slot-button"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Turno
                </Button>
              </div>

              {slots.length === 0 ? (
                <p className="text-white/60 text-center py-8" data-testid="no-slots-message">
                  No hay turnos creados todavía
                </p>
              ) : (
                <div className="space-y-4">
                  {slots
                    .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`))
                    .map((slot, index) => (
                      <div 
                        key={slot.slot_id} 
                        className="border border-white/5 p-4 flex justify-between items-center"
                        data-testid={`slot-item-${index}`}
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          <div className={`px-3 py-1 rounded text-xs font-semibold uppercase border ${getActivityColor(slot.activity_type)}`}>
                            {getActivityLabel(slot.activity_type)}
                          </div>
                          <div>
                            <p className="text-white font-bold">{slot.date} - {slot.time}</p>
                            <p className="text-white/60 text-sm">
                              Cupos: {slot.current_bookings}/{slot.max_capacity} | 
                              Costo: {slot.credits_cost} créditos
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleDeleteSlot(slot.slot_id)}
                          variant="outline"
                          size="sm"
                          className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                          data-testid={`delete-slot-button-${index}`}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            <div className="glass-card p-6">
              <h2 className="font-barlow text-2xl font-bold text-white uppercase mb-6">Todas las Reservas</h2>

              {bookings.length === 0 ? (
                <p className="text-white/60 text-center py-8" data-testid="no-bookings-message">
                  No hay reservas todavía
                </p>
              ) : (
                <div className="space-y-4">
                  {bookings
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map((booking, index) => (
                      <div 
                        key={booking.booking_id} 
                        className={`border border-white/5 p-4 ${booking.status === 'cancelled' ? 'opacity-50' : ''}`}
                        data-testid={`booking-item-${index}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className={`px-3 py-1 rounded text-xs font-semibold uppercase border ${getActivityColor(booking.activity_type)}`}>
                                {getActivityLabel(booking.activity_type)}
                              </div>
                              <span className={`px-3 py-1 rounded text-xs font-semibold uppercase ${
                                booking.status === 'confirmed' 
                                  ? 'bg-primary/20 text-primary' 
                                  : 'bg-white/5 text-white/40'
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
                            <p className="text-white/60 text-sm">
                              Créditos: {booking.credits_cost}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="glass-card p-6">
              <h2 className="font-barlow text-2xl font-bold text-white uppercase mb-6">Gestión de Usuarios</h2>

              {users.length === 0 ? (
                <p className="text-white/60 text-center py-8" data-testid="no-users-message">
                  No hay usuarios registrados
                </p>
              ) : (
                <div className="space-y-4">
                  {users
                    .sort((a, b) => b.credits - a.credits)
                    .map((u, index) => (
                      <div 
                        key={u.user_id} 
                        className="border border-white/5 p-4 flex justify-between items-center"
                        data-testid={`user-item-${index}`}
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="text-white font-bold">{u.name}</p>
                            <p className="text-white/60 text-sm">{u.email}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                                u.role === 'admin' 
                                  ? 'bg-red-500/20 text-red-400' 
                                  : 'bg-blue-500/20 text-blue-400'
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
                          data-testid={`assign-credits-button-${index}`}
                        >
                          <CreditCard className="w-4 h-4 mr-1" />
                          Asignar Créditos
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Slot Modal */}
      <Dialog open={showCreateSlot} onOpenChange={setShowCreateSlot}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white" data-testid="create-slot-modal">
          <DialogHeader>
            <DialogTitle className="font-barlow text-2xl uppercase">Crear Nuevo Turno</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSlot} className="space-y-4">
            <div>
              <Label htmlFor="activity_type" className="text-white mb-2 block">Tipo de Actividad</Label>
              <Select 
                value={newSlot.activity_type} 
                onValueChange={(value) => setNewSlot({ ...newSlot, activity_type: value })}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="activity-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="entrenamiento">Entrenamiento</SelectItem>
                  <SelectItem value="rehabilitacion">Rehabilitación</SelectItem>
                  <SelectItem value="nutricion">Nutrición</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date" className="text-white mb-2 block">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={newSlot.date}
                onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })}
                required
                className="bg-zinc-950 border-zinc-800 h-12"
                data-testid="slot-date-input"
              />
            </div>

            <div>
              <Label htmlFor="time" className="text-white mb-2 block">Hora</Label>
              <Input
                id="time"
                type="time"
                value={newSlot.time}
                onChange={(e) => setNewSlot({ ...newSlot, time: e.target.value })}
                required
                className="bg-zinc-950 border-zinc-800 h-12"
                data-testid="slot-time-input"
              />
            </div>

            <div>
              <Label htmlFor="max_capacity" className="text-white mb-2 block">Capacidad Máxima</Label>
              <Input
                id="max_capacity"
                type="number"
                min="1"
                max="10"
                value={newSlot.max_capacity}
                onChange={(e) => setNewSlot({ ...newSlot, max_capacity: parseInt(e.target.value) })}
                required
                className="bg-zinc-950 border-zinc-800 h-12"
                data-testid="slot-capacity-input"
              />
            </div>

            <div>
              <Label htmlFor="credits_cost" className="text-white mb-2 block">Costo en Créditos</Label>
              <Input
                id="credits_cost"
                type="number"
                min="1"
                value={newSlot.credits_cost}
                onChange={(e) => setNewSlot({ ...newSlot, credits_cost: parseInt(e.target.value) })}
                required
                className="bg-zinc-950 border-zinc-800 h-12"
                data-testid="slot-credits-input"
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90" data-testid="submit-create-slot">
                Crear Turno
              </Button>
              <Button 
                type="button"
                onClick={() => setShowCreateSlot(false)} 
                variant="outline"
                className="flex-1 border-white/20"
                data-testid="cancel-create-slot"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Credits Modal */}
      <Dialog open={showAssignCredits} onOpenChange={setShowAssignCredits}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white" data-testid="assign-credits-modal">
          <DialogHeader>
            <DialogTitle className="font-barlow text-2xl uppercase">Asignar Créditos</DialogTitle>
            {selectedUser && (
              <DialogDescription className="text-white/60">
                Usuario: {selectedUser.name} | Créditos actuales: {selectedUser.credits}
              </DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={handleAssignCredits} className="space-y-4">
            <div>
              <Label htmlFor="credits" className="text-white mb-2 block">
                Créditos (positivo para agregar, negativo para quitar)
              </Label>
              <Input
                id="credits"
                type="number"
                value={creditAssignment.credits}
                onChange={(e) => setCreditAssignment({ ...creditAssignment, credits: e.target.value })}
                required
                className="bg-zinc-950 border-zinc-800 h-12"
                data-testid="credits-amount-input"
              />
            </div>

            <div>
              <Label htmlFor="reason" className="text-white mb-2 block">Motivo</Label>
              <Input
                id="reason"
                type="text"
                placeholder="Ej: Compra de paquete, Devolución, etc."
                value={creditAssignment.reason}
                onChange={(e) => setCreditAssignment({ ...creditAssignment, reason: e.target.value })}
                required
                className="bg-zinc-950 border-zinc-800 h-12"
                data-testid="credits-reason-input"
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90" data-testid="submit-assign-credits">
                Asignar Créditos
              </Button>
              <Button 
                type="button"
                onClick={() => {
                  setShowAssignCredits(false);
                  setSelectedUser(null);
                }} 
                variant="outline"
                className="flex-1 border-white/20"
                data-testid="cancel-assign-credits"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
