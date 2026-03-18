import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { LogOut, Calendar, CreditCard, History, User, Clock, X } from 'lucide-react';

moment.locale('es');
const localizer = momentLocalizer(moment);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ClientDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(location.state?.user || null);
  const [loading, setLoading] = useState(!user);
  const [slots, setSlots] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [filterActivity, setFilterActivity] = useState('all');

  useEffect(() => {
    if (!user) {
      checkAuth();
    } else {
      loadData();
    }
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Debes iniciar sesión');
      navigate('/login');
    }
  };

  const loadData = async () => {
    try {
      const [slotsRes, bookingsRes] = await Promise.all([
        axios.get(`${API}/calendar/available`, { withCredentials: true }),
        axios.get(`${API}/bookings/my`, { withCredentials: true })
      ]);
      setSlots(slotsRes.data);
      setMyBookings(bookingsRes.data);
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

  const handleBooking = async () => {
    if (!selectedSlot) return;

    try {
      await axios.post(`${API}/bookings`, { slot_id: selectedSlot.slot_id }, { withCredentials: true });
      toast.success('Turno reservado exitosamente');
      setShowBookingModal(false);
      setSelectedSlot(null);
      loadData();
      // Reload user to get updated credits
      const userRes = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(userRes.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al reservar');
    }
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;

    try {
      const response = await axios.delete(`${API}/bookings/${selectedBooking.booking_id}`, { withCredentials: true });
      if (response.data.refunded) {
        toast.success(`Turno cancelado. Se devolvieron ${response.data.credits_refunded} créditos`);
      } else {
        toast.info('Turno cancelado. No se devolvieron créditos (cancelación con menos de 6 horas)');
      }
      setShowCancelModal(false);
      setSelectedBooking(null);
      loadData();
      // Reload user to get updated credits
      const userRes = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(userRes.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cancelar');
    }
  };

  const getActivityColor = (activity) => {
    const colors = {
      entrenamiento: '#2563EB',
      rehabilitacion: '#10B981',
      nutricion: '#F59E0B'
    };
    return colors[activity] || '#2563EB';
  };

  const getActivityLabel = (activity) => {
    const labels = {
      entrenamiento: 'Entrenamiento',
      rehabilitacion: 'Rehabilitación',
      nutricion: 'Nutrición'
    };
    return labels[activity] || activity;
  };

  // Convert slots to calendar events
  const calendarEvents = slots
    .filter(slot => filterActivity === 'all' || slot.activity_type === filterActivity)
    .map(slot => ({
      id: slot.slot_id,
      title: `${getActivityLabel(slot.activity_type)} (${slot.current_bookings}/${slot.max_capacity})`,
      start: new Date(`${slot.date}T${slot.time}:00`),
      end: new Date(`${slot.date}T${slot.time}:00`),
      resource: slot,
      color: getActivityColor(slot.activity_type)
    }));

  const eventStyleGetter = (event) => {
    return {
      style: {
        backgroundColor: event.color,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '0.85rem',
        padding: '2px 4px'
      }
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-spinner">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="client-dashboard">
      {/* Header */}
      <header className="bg-zinc-900/50 border-b border-white/5 px-6 py-4" data-testid="dashboard-header">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-barlow text-2xl font-bold text-white uppercase" data-testid="dashboard-title">
              Panel de Cliente
            </h1>
            <p className="text-white/60 text-sm">Bienvenido, {user?.name}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="glass-card px-4 py-2 flex items-center space-x-2" data-testid="credits-display">
              <CreditCard className="w-5 h-5 text-primary" />
              <span className="text-white font-bold">{user?.credits || 0}</span>
              <span className="text-white/60 text-sm">créditos</span>
            </div>
            <Button 
              onClick={handleLogout} 
              variant="outline" 
              className="border-white/20 hover:bg-white/10"
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-card p-6" data-testid="stats-credits">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Créditos Disponibles</p>
                <p className="font-barlow text-4xl font-bold text-primary">{user?.credits || 0}</p>
              </div>
              <CreditCard className="w-12 h-12 text-primary opacity-50" />
            </div>
          </div>

          <div className="glass-card p-6" data-testid="stats-bookings">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Reservas Activas</p>
                <p className="font-barlow text-4xl font-bold text-white">
                  {myBookings.filter(b => b.status === 'confirmed').length}
                </p>
              </div>
              <Calendar className="w-12 h-12 text-primary opacity-50" />
            </div>
          </div>

          <div className="glass-card p-6" data-testid="stats-history">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Total Reservas</p>
                <p className="font-barlow text-4xl font-bold text-white">{myBookings.length}</p>
              </div>
              <History className="w-12 h-12 text-primary opacity-50" />
            </div>
          </div>
        </div>

        {/* Calendar Section */}
        <div className="glass-card p-6 mb-8" data-testid="calendar-section">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-barlow text-2xl font-bold text-white uppercase">Calendario de Turnos</h2>
            <Select value={filterActivity} onValueChange={setFilterActivity}>
              <SelectTrigger className="w-48 bg-zinc-950 border-zinc-800" data-testid="activity-filter">
                <SelectValue placeholder="Filtrar actividad" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">Todas las actividades</SelectItem>
                <SelectItem value="entrenamiento">Entrenamiento</SelectItem>
                <SelectItem value="rehabilitacion">Rehabilitación</SelectItem>
                <SelectItem value="nutricion">Nutrición</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div style={{ height: '600px' }} className="bg-zinc-900/50 p-4 rounded">
            <BigCalendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              eventPropGetter={eventStyleGetter}
              onSelectEvent={(event) => {
                if (event.resource.available) {
                  setSelectedSlot(event.resource);
                  setShowBookingModal(true);
                } else {
                  toast.info('Este turno está lleno');
                }
              }}
              messages={{
                next: 'Siguiente',
                previous: 'Anterior',
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día',
                agenda: 'Agenda',
                date: 'Fecha',
                time: 'Hora',
                event: 'Turno',
                noEventsInRange: 'No hay turnos en este rango'
              }}
              data-testid="calendar-widget"
            />
          </div>
        </div>

        {/* My Bookings */}
        <div className="glass-card p-6" data-testid="my-bookings-section">
          <h2 className="font-barlow text-2xl font-bold text-white uppercase mb-6">Mis Reservas</h2>
          
          {myBookings.length === 0 ? (
            <p className="text-white/60 text-center py-8" data-testid="no-bookings-message">
              No tienes reservas todavía. ¡Reserva tu primer turno!
            </p>
          ) : (
            <div className="space-y-4">
              {myBookings
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map((booking, index) => (
                  <div 
                    key={booking.booking_id} 
                    className={`border border-white/5 p-4 flex justify-between items-center ${
                      booking.status === 'cancelled' ? 'opacity-50' : ''
                    }`}
                    data-testid={`booking-item-${index}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div 
                        className="w-2 h-12 rounded-full" 
                        style={{ backgroundColor: getActivityColor(booking.activity_type) }}
                      ></div>
                      <div>
                        <h3 className="font-bold text-white uppercase text-sm">
                          {getActivityLabel(booking.activity_type)}
                        </h3>
                        <p className="text-white/60 text-sm flex items-center mt-1">
                          <Calendar className="w-4 h-4 mr-1" />
                          {booking.date}
                        </p>
                        <p className="text-white/60 text-sm flex items-center mt-1">
                          <Clock className="w-4 h-4 mr-1" />
                          {booking.time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded text-xs font-semibold uppercase ${
                          booking.status === 'confirmed' 
                            ? 'bg-primary/20 text-primary' 
                            : 'bg-white/5 text-white/40'
                        }`}>
                          {booking.status === 'confirmed' ? 'Confirmada' : 'Cancelada'}
                        </span>
                        <p className="text-white/40 text-xs mt-1">{booking.credits_cost} créditos</p>
                      </div>
                      {booking.status === 'confirmed' && (
                        <Button
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowCancelModal(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                          data-testid={`cancel-booking-button-${index}`}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Booking Modal */}
      <Dialog open={showBookingModal} onOpenChange={setShowBookingModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white" data-testid="booking-modal">
          <DialogHeader>
            <DialogTitle className="font-barlow text-2xl uppercase">Confirmar Reserva</DialogTitle>
            <DialogDescription className="text-white/60">
              Revisa los detalles de tu turno antes de confirmar
            </DialogDescription>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 bg-zinc-950 rounded">
                <span className="text-white/60">Actividad:</span>
                <span className="font-bold text-white uppercase">{getActivityLabel(selectedSlot.activity_type)}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-zinc-950 rounded">
                <span className="text-white/60">Fecha:</span>
                <span className="font-bold text-white">{selectedSlot.date}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-zinc-950 rounded">
                <span className="text-white/60">Hora:</span>
                <span className="font-bold text-white">{selectedSlot.time}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-zinc-950 rounded">
                <span className="text-white/60">Costo:</span>
                <span className="font-bold text-primary">{selectedSlot.credits_cost} créditos</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-zinc-950 rounded">
                <span className="text-white/60">Lugares disponibles:</span>
                <span className="font-bold text-white">{selectedSlot.spots_left} / {selectedSlot.max_capacity}</span>
              </div>
              
              {user?.credits < selectedSlot.credits_cost ? (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded">
                  <p className="text-red-400 text-sm">No tienes suficientes créditos para esta reserva</p>
                </div>
              ) : (
                <div className="flex space-x-3">
                  <Button 
                    onClick={handleBooking} 
                    className="flex-1 bg-primary hover:bg-primary/90"
                    data-testid="confirm-booking-button"
                  >
                    Confirmar Reserva
                  </Button>
                  <Button 
                    onClick={() => setShowBookingModal(false)} 
                    variant="outline"
                    className="flex-1 border-white/20"
                    data-testid="cancel-booking-modal-button"
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Booking Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white" data-testid="cancel-booking-modal">
          <DialogHeader>
            <DialogTitle className="font-barlow text-2xl uppercase">Cancelar Reserva</DialogTitle>
            <DialogDescription className="text-white/60">
              ¿Estás seguro que deseas cancelar esta reserva?
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 py-4">
              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded">
                <p className="text-yellow-400 text-sm">
                  <strong>Política de cancelación:</strong> Si cancelas con más de 6 horas de anticipación, 
                  se te devolverán los créditos. De lo contrario, no habrá devolución.
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-white/60">Actividad: <span className="text-white font-bold">{getActivityLabel(selectedBooking.activity_type)}</span></p>
                <p className="text-white/60">Fecha: <span className="text-white font-bold">{selectedBooking.date}</span></p>
                <p className="text-white/60">Hora: <span className="text-white font-bold">{selectedBooking.time}</span></p>
              </div>
              
              <div className="flex space-x-3">
                <Button 
                  onClick={handleCancelBooking} 
                  variant="destructive"
                  className="flex-1"
                  data-testid="confirm-cancel-button"
                >
                  Sí, cancelar reserva
                </Button>
                <Button 
                  onClick={() => setShowCancelModal(false)} 
                  variant="outline"
                  className="flex-1 border-white/20"
                  data-testid="keep-booking-button"
                >
                  No, mantener reserva
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDashboard;
