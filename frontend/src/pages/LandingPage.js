import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Users, Heart, Zap, Clock, Phone, Instagram, MapPin } from 'lucide-react';
import { Button } from '../components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LandingPage = () => {
  const navigate = useNavigate();
  const servicesRef = useRef(null);
  const contactRef = useRef(null);

  const services = [
    {
      title: 'Entrenamiento Personalizado',
      subtitle: 'Grupo Reducido',
      description: 'Máximo 5 personas por sesión. Entrenamiento personalizado con seguimiento continuo.',
      duration: '1 hora',
      icon: Users,
      image: 'https://images.unsplash.com/photo-1739430548335-6b3e76ddbd10?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NjZ8MHwxfHNlYXJjaHwzfHxpbnRlbnNlJTIwZml0bmVzcyUyMHRyYWluaW5nJTIwZ3ltJTIwd29ya291dCUyMG1vdGl2YXRpb258ZW58MHx8fHwxNzczNzk5MDE5fDA&ixlib=rb-4.1.0&q=85'
    },
    {
      title: 'One to One',
      subtitle: 'Entrenamiento Individual',
      description: 'Atención 100% personalizada para alcanzar tus objetivos más rápido.',
      duration: '1h - 1h30',
      icon: Zap,
      image: 'https://images.unsplash.com/photo-1739430548323-d3a55a714052?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NjZ8MHwxfHNlYXJjaHwxfHxpbnRlbnNlJTIwZml0bmVzcyUyMHRyYWluaW5nJTIwZ3ltJTIwd29ya291dCUyMG1vdGl2YXRpb258ZW58MHx8fHwxNzczNzk5MDE5fDA&ixlib=rb-4.1.0&q=85'
    },
    {
      title: 'Nutrición',
      subtitle: 'Seguimiento Personalizado',
      description: 'Plan nutricional adaptado a tus necesidades y objetivos fitness.',
      duration: 'Consulta',
      icon: Heart,
      image: 'https://images.unsplash.com/photo-1669490884223-ca6ca27c8766?q=85&w=800&auto=format&fit=crop'
    },
    {
      title: 'Rehabilitación',
      subtitle: 'Recuperación Física',
      description: 'Programas especializados para recuperación y prevención de lesiones.',
      duration: '1 hora',
      icon: Calendar,
      image: 'https://images.unsplash.com/photo-1650044252595-cacd425982ff?q=85&w=800&auto=format&fit=crop'
    }
  ];

  const schedule = [
    { day: 'Lunes - Viernes', time: '06:00 - 13:00', activity: 'Entrenamiento y Rehabilitación' },
    { day: 'Lunes - Viernes', time: '15:00 - 22:00', activity: 'Entrenamiento y Rehabilitación' },
    { day: 'Martes, Jueves, Sábado', time: '10:00 - 12:00', activity: 'Nutrición' }
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#09090B]/80 backdrop-blur-md border-b border-white/5" data-testid="main-navbar">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3" data-testid="logo-section">
            <img 
              src="https://customer-assets.emergentagent.com/job_spark-elite/artifacts/s7blch7o_Captura%20de%20pantalla%202026-03-18%20024940.png" 
              alt="Spark Fit Logo" 
              className="h-12 w-auto"
            />
          </div>
          <div className="hidden md:flex space-x-8">
            <button onClick={() => servicesRef.current?.scrollIntoView({ behavior: 'smooth' })} className="text-white/80 hover:text-white transition-colors uppercase text-sm tracking-wider">Servicios</button>
            <button onClick={() => contactRef.current?.scrollIntoView({ behavior: 'smooth' })} className="text-white/80 hover:text-white transition-colors uppercase text-sm tracking-wider">Contacto</button>
            <button onClick={() => navigate('/login')} className="text-primary hover:text-primary/80 transition-colors uppercase text-sm tracking-wider font-semibold" data-testid="nav-login-btn">Ingresar</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-end" data-testid="hero-section">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1770513649465-2c60c8039806?q=85&w=1920&auto=format&fit=crop" 
            alt="Gym interior" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/80 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-24 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="font-barlow text-6xl md:text-8xl font-bold uppercase tracking-tighter text-white mb-6" data-testid="hero-title">
              Cambiá tu<br />
              <span className="text-primary">estilo de vida</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mb-8 max-w-2xl" data-testid="hero-subtitle">
              Fortaleciendo tu mente y tu cuerpo
            </p>
            <div className="flex flex-wrap gap-4">
              <Button 
                onClick={() => navigate('/login')} 
                className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base uppercase tracking-widest skew-btn font-bold"
                data-testid="hero-cta-button"
              >
                Reservar Turno
              </Button>
              <Button 
                onClick={() => servicesRef.current?.scrollIntoView({ behavior: 'smooth' })}
                variant="outline" 
                className="border-white/20 text-white hover:bg-white hover:text-black px-8 py-6 text-base uppercase tracking-widest transition-all duration-300"
                data-testid="hero-services-button"
              >
                Conocer Servicios
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section ref={servicesRef} className="py-24 px-6" data-testid="services-section">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-barlow text-4xl md:text-6xl font-bold uppercase tracking-tight text-white mb-4 text-center" data-testid="services-title">
              Nuestros Servicios
            </h2>
            <p className="text-white/60 text-center mb-16 text-lg">Entrenamiento premium personalizado</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="group relative bg-zinc-900/50 border border-white/5 p-8 hover:border-primary/50 transition-all duration-300 overflow-hidden"
                  data-testid={`service-card-${index}`}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <img src={service.image} alt={service.title} className="w-full h-full object-cover opacity-20" />
                  </div>
                  <div className="relative z-10">
                    <Icon className="w-12 h-12 text-primary mb-4" strokeWidth={1.5} />
                    <h3 className="font-barlow text-2xl md:text-3xl font-bold uppercase text-white mb-2">{service.title}</h3>
                    <p className="text-primary text-sm uppercase tracking-wider mb-4">{service.subtitle}</p>
                    <p className="text-white/70 mb-4">{service.description}</p>
                    <div className="flex items-center text-white/50 text-sm">
                      <Clock className="w-4 h-4 mr-2" />
                      {service.duration}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-24 px-6 bg-zinc-900/30" data-testid="about-section">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-barlow text-4xl md:text-6xl font-bold uppercase tracking-tight text-white mb-6" data-testid="about-title">
              Sobre Nosotros
            </h2>
            <p className="text-white/70 text-lg mb-6">
              En Spark Fit creemos que el fitness es un estilo de vida. Nuestro enfoque se centra en entrenamientos personalizados en grupos reducidos, donde cada persona recibe la atención que merece.
            </p>
            <p className="text-white/70 text-lg">
              Combinamos entrenamiento de alta intensidad, nutrición personalizada y rehabilitación para ofrecerte un programa integral que transforma tu mente y tu cuerpo.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative h-96"
          >
            <img 
              src="https://images.unsplash.com/photo-1739430547883-dc519d7f7e56?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NjZ8MHwxfHNlYXJjaHwyfHxpbnRlbnNlJTIwZml0bmVzcyUyMHRyYWluaW5nJTIwZ3ltJTIwd29ya291dCUyMG1vdGl2YXRpb258ZW58MHx8fHwxNzczNzk5MDE5fDA&ixlib=rb-4.1.0&q=85" 
              alt="Training" 
              className="w-full h-full object-cover border border-white/10"
            />
          </motion.div>
        </div>
      </section>

      {/* Schedule Section */}
      <section className="py-24 px-6" data-testid="schedule-section">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-barlow text-4xl md:text-6xl font-bold uppercase tracking-tight text-white mb-4 text-center" data-testid="schedule-title">
              Horarios
            </h2>
            <p className="text-white/60 text-center mb-16 text-lg">Encontrá el horario que mejor se adapte a vos</p>
          </motion.div>

          <div className="space-y-4">
            {schedule.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="glass-card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                data-testid={`schedule-item-${index}`}
              >
                <div>
                  <h3 className="font-barlow text-xl font-bold text-white uppercase">{item.day}</h3>
                  <p className="text-primary text-sm">{item.activity}</p>
                </div>
                <div className="flex items-center text-white/70">
                  <Clock className="w-5 h-5 mr-2" />
                  <span className="text-lg font-semibold">{item.time}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section ref={contactRef} className="py-24 px-6 bg-zinc-900/30" data-testid="contact-section">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-barlow text-4xl md:text-6xl font-bold uppercase tracking-tight text-white mb-4 text-center" data-testid="contact-title">
              Contacto
            </h2>
            <p className="text-white/60 text-center mb-16 text-lg">Empezá tu transformación hoy</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.a
              href="https://wa.me/5492617462186"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="glass-card p-8 hover:border-primary/50 transition-all duration-300 flex items-center space-x-4 group"
              data-testid="contact-whatsapp"
            >
              <Phone className="w-10 h-10 text-primary" />
              <div>
                <h3 className="font-barlow text-xl font-bold text-white uppercase mb-1">WhatsApp</h3>
                <p className="text-white/70 group-hover:text-primary transition-colors">+54 261 7462186</p>
              </div>
            </motion.a>

            <motion.a
              href="https://www.instagram.com/sspark.fit"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="glass-card p-8 hover:border-primary/50 transition-all duration-300 flex items-center space-x-4 group"
              data-testid="contact-instagram"
            >
              <Instagram className="w-10 h-10 text-primary" />
              <div>
                <h3 className="font-barlow text-xl font-bold text-white uppercase mb-1">Instagram</h3>
                <p className="text-white/70 group-hover:text-primary transition-colors">@sspark.fit</p>
              </div>
            </motion.a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5" data-testid="footer">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-white/40 text-sm">
            © 2026 Spark Fit - Centro de Entrenamientos. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
