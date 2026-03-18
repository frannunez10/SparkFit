import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { LogOut, Calendar, CreditCard, History, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ClientDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(location.state?.user || null);
  const [loading, setLoading] = useState(!user);
  const [myBookings, setMyBookings] = useState([]);
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [availableActivities, setAvailableActivities] = useState([]);
  
  // Modal states
  const [showBookingFlow, setShowBookingFlow] = useState(false);
  const [bookingStep, setBookingStep] = useState(1); // 1: date, 2: time, 3: activity
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    if (!user) {
      checkAuth();
    } else {
      loadBookings();
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

  const loadBookings = async () => {
    try {
      const response = await axios.get(`${API}/bookings/my`, { withCredentials: true });
      setMyBookings(response.data);
    } catch (error) {
      toast.error('Error al cargar reservas');
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

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty slots for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of month
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7); // 1 week limit
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDay = new Date(year, month, day);
      currentDay.setHours(0, 0, 0, 0);
      
      const isPast = currentDay < today;
      const isBeyondLimit = currentDay > maxDate;
      const isDisabled = isPast || isBeyondLimit;
      
      days.push({
        day,
        date: currentDay,
        isToday: currentDay.getTime() === today.getTime(),
        isDisabled
      });
    }
    
    return days;
  };

  const formatDateForAPI = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateSelect = async (dateObj) => {
    if (dateObj.isDisabled) return;
    
    setSelectedDate(dateObj.date);
    setSelectedTime(null);
    setSelectedActivity(null);
    setBookingStep(2);
    
    // Load time slots for selected date
    try {
      const formattedDate = formatDateForAPI(dateObj.date);
      const response = await axios.get(`${API}/calendar/time-slots?date=${formattedDate}`, { withCredentials: true });
      setTimeSlots(response.data);
    } catch (error) {
      toast.error('Error al cargar horarios');
    }
  };

  const handleTimeSelect = async (time) => {
    setSelectedTime(time);
    setSelectedActivity(null);
    setBookingStep(3);
    
    // Load available activities for selected time
    try {
      const formattedDate = formatDateForAPI(selectedDate);
      const response = await axios.get(
        `${API}/calendar/activities-for-slot?date=${formattedDate}&time=${time}`,
        { withCredentials: true }
      );
      setAvailableActivities(response.data);
    } catch (error) {
      toast.error('Error al cargar actividades');
    }
  };

  const handleActivitySelect = (activity) => {
    setSelectedActivity(activity);
  };

  const handleConfirmBooking = async () => {
    if (!selectedActivity) return;
    
    try {
      await axios.post(`${API}/bookings`, { slot_id: selectedActivity.slot_id }, { withCredentials: true });
      toast.success('Turno reservado exitosamente');
      setShowBookingFlow(false);
      resetBookingFlow();
      loadBookings();
      
      // Reload user to get updated credits
      const userRes = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(userRes.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al reservar');
    }
  };

  const resetBookingFlow = () => {
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedActivity(null);
    setBookingStep(1);
    setTimeSlots([]);
    setAvailableActivities([]);
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
      loadBookings();
      
      const userRes = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(userRes.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cancelar');
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
      entrenamiento: '#2563EB',
      rehabilitacion: '#10B981',
      nutricion: '#F59E0B'
    };
    return colors[activity] || '#2563EB';
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

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

        {/* Reserve Button */}
        <div className="mb-8">
          <Button
            onClick={() => {
              resetBookingFlow();
              setShowBookingFlow(true);
            }}
            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-lg py-6 px-8"
            data-testid="open-booking-button"
          >
            <Calendar className="w-5 h-5 mr-2" />
            Reservar Nuevo Turno
          </Button>
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

      {/* Booking Flow Modal */}
      <Dialog open={showBookingFlow} onOpenChange={(open) => {
        if (!open) resetBookingFlow();
        setShowBookingFlow(open);
      }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-4xl" data-testid="booking-modal">
          <DialogHeader>
            <DialogTitle className="font-barlow text-2xl uppercase">
              Reservar Turno - Paso {bookingStep} de 3
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {bookingStep === 1 && 'Selecciona una fecha (máximo 1 semana de anticipación)'}
              {bookingStep === 2 && 'Selecciona un horario disponible'}
              {bookingStep === 3 && 'Selecciona la actividad que deseas realizar'}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Date Selection */}
          {bookingStep === 1 && (
            <div className="py-4">
              <div className="flex items-center justify-between mb-6">
                <Button
                  onClick={previousMonth}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h3 className="font-barlow text-xl font-bold text-white">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
                <Button
                  onClick={nextMonth}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-white/60 text-sm font-semibold py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {getDaysInMonth(currentDate).map((dayObj, index) => (
                  <button
                    key={index}
                    onClick={() => dayObj && handleDateSelect(dayObj)}
                    disabled={!dayObj || dayObj.isDisabled}
                    className={`
                      aspect-square p-2 rounded-lg text-sm font-medium transition-all
                      ${
                        !dayObj
                          ? 'invisible'
                          : dayObj.isDisabled
                          ? 'bg-zinc-900/50 text-white/20 cursor-not-allowed'
                          : dayObj.isToday
                          ? 'bg-primary text-white hover:bg-primary/90'
                          : 'bg-zinc-800/50 text-white hover:bg-zinc-700'
                      }
                    `}
                  >
                    {dayObj?.day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Time Selection */}
          {bookingStep === 2 && (
            <div className="py-4">
              <Button
                onClick={() => setBookingStep(1)}
                variant="ghost"
                size="sm"
                className="mb-4 text-white/60 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Cambiar fecha
              </Button>

              <p className="text-white mb-4">Fecha seleccionada: <span className="text-primary font-bold">{selectedDate?.toLocaleDateString('es-AR')}</span></p>

              {timeSlots.length === 0 ? (
                <p className="text-white/60 text-center py-8">No hay horarios disponibles para esta fecha</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => !slot.is_full && handleTimeSelect(slot.time)}
                      disabled={slot.is_full}
                      className={`
                        p-4 rounded-lg border transition-all text-center
                        ${
                          slot.is_full
                            ? 'bg-zinc-900/30 border-white/5 text-white/30 cursor-not-allowed'
                            : 'bg-zinc-800/50 border-white/10 text-white hover:border-primary hover:bg-zinc-700'
                        }
                      `}
                    >
                      <Clock className="w-6 h-6 mx-auto mb-2" />
                      <p className="font-bold">{slot.time}</p>
                      {slot.is_full && <p className="text-xs mt-1">Completo</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Activity Selection */}
          {bookingStep === 3 && (
            <div className="py-4">
              <Button
                onClick={() => setBookingStep(2)}
                variant="ghost"
                size="sm"
                className="mb-4 text-white/60 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Cambiar horario
              </Button>

              <p className="text-white mb-2">Fecha: <span className="text-primary font-bold">{selectedDate?.toLocaleDateString('es-AR')}</span></p>
              <p className="text-white mb-4">Hora: <span className="text-primary font-bold">{selectedTime}</span></p>

              {availableActivities.length === 0 ? (
                <p className="text-white/60 text-center py-8">No hay actividades disponibles para este horario</p>
              ) : (
                <div className="space-y-3">
                  {availableActivities.map((activity) => (
                    <button
                      key={activity.slot_id}
                      onClick={() => handleActivitySelect(activity)}
                      className={`
                        w-full p-4 rounded-lg border transition-all text-left
                        ${
                          selectedActivity?.slot_id === activity.slot_id
                            ? 'bg-primary/20 border-primary'
                            : 'bg-zinc-800/50 border-white/10 hover:border-primary/50'
                        }
                      `}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-white text-lg uppercase">
                            {getActivityLabel(activity.activity_type)}
                          </h3>
                        </div>
                        <div className="text-right">
                          <p className="text-primary font-bold">{activity.credits_cost} créditos</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedActivity && (
                <div className="mt-6 flex space-x-3">
                  <Button
                    onClick={handleConfirmBooking}
                    className="flex-1 bg-primary hover:bg-primary/90"
                    data-testid="confirm-booking-button"
                  >
                    Confirmar Reserva
                  </Button>
                  <Button
                    onClick={() => setShowBookingFlow(false)}
                    variant="outline"
                    className="flex-1 border-white/20"
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