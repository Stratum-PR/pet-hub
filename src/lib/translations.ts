export type Language = 'en' | 'es';

export interface Translations {
  [key: string]: {
    en: string;
    es: string;
  };
}

export const translations: Translations = {
  // Landing / Home
  'landing.title': {
    en: 'Professional Pet Grooming',
    es: 'Grooming Profesional para Mascotas'
  },
  'landing.subtitle': {
    en: 'Management Made Simple',
    es: 'Administración Hecha Simple'
  },
  'landing.heroText': {
    en: 'Streamline your grooming business with powerful scheduling, customer management, and revenue tracking tools. Start your free trial today.',
    es: 'Optimiza tu negocio de grooming con herramientas poderosas de citas, manejo de clientes y seguimiento de ingresos. Comienza tu prueba gratis hoy.'
  },
  'landing.login': {
    en: 'Login',
    es: 'Login'
  },
  'landing.getStarted': {
    en: 'Get Started',
    es: 'Registrarse'
  },
  'landing.startFreeTrial': {
    en: 'Start Free Trial',
    es: 'Registrarse Trial Gratis'
  },
  'landing.viewDemo': {
    en: 'View Demo',
    es: 'Ver Demo'
  },
  'landing.featureSchedulingTitle': {
    en: 'Easy Scheduling',
    es: 'Agenda Sencilla'
  },
  'landing.featureSchedulingText': {
    en: 'Manage appointments effortlessly with our intuitive calendar system. Never double-book again with real-time availability.',
    es: 'Maneja tus citas sin complicaciones con nuestro calendario intuitivo. Nunca vuelves a duplicar citas gracias a la disponibilidad en tiempo real.'
  },
  'landing.featureCustomersTitle': {
    en: 'Customer Management',
    es: 'Manejo de Clientes'
  },
  'landing.featureCustomersText': {
    en: 'Keep detailed records of your clients and their pets. Track preferences, history, and special instructions all in one place.',
    es: 'Mantén registros detallados de tus clientes y tus mascotas. Lleva control de preferencias, historial e instrucciones especiales en un solo lugar.'
  },
  'landing.featureRevenueTitle': {
    en: 'Revenue Tracking',
    es: 'Seguimiento de Ingresos'
  },
  'landing.featureRevenueText': {
    en: 'Monitor your business performance with comprehensive analytics. Track revenue, appointments, and growth metrics.',
    es: 'Monitorea el rendimiento de tu negocio con análisis completos. Lleva control de ingresos, citas y métricas de crecimiento.'
  },
  'landing.readyTitle': {
    en: 'Ready to Get Started?',
    es: '¿Listo para Comenzar?'
  },
  'landing.readyText': {
    en: 'Choose the plan that fits your business. All plans include a 14-day free trial.',
    es: 'Elige el plan que mejor se ajuste a tu negocio. Todos los planes incluyen una prueba gratis de 14 días.'
  },
  'landing.viewPricingPlans': {
    en: 'View Pricing Plans',
    es: 'Ver Planes de Precios'
  },

  // Login page
  'login.title': {
    en: 'Welcome Back',
    es: 'Bienvenido de Nuevo'
  },
  'login.subtitle': {
    en: 'Sign in to your account',
    es: 'Inicia sesión en tu cuenta'
  },
  'login.email': {
    en: 'Email',
    es: 'Correo Electrónico'
  },
  'login.password': {
    en: 'Password',
    es: 'Contraseña'
  },
  'login.signIn': {
    en: 'Sign In',
    es: 'Entrar'
  },
  'login.signingIn': {
    en: 'Signing in...',
    es: 'Entrando...'
  },
  'login.demoPrompt': {
    en: 'Want to try it first?',
    es: '¿Quieres probarlo primero?'
  },
  'login.viewDemo': {
    en: 'View Demo',
    es: 'Ver Demo'
  },
  'login.noAccount': {
    en: "Don't have an account?",
    es: '¿No tienes cuenta?'
  },
  'login.startTrial': {
    en: 'Start your free trial',
    es: 'Comienza tu prueba gratis'
  },

  // Register page
  'register.title': {
    en: 'Create your account',
    es: 'Crea tu cuenta'
  },
  'register.subtitle': {
    en: 'Join Stratum Hub',
    es: 'Únete a Stratum Hub'
  },
  'register.userTypeQuestion': {
    en: 'Are you a business owner or a client?',
    es: '¿Eres dueño de negocio o cliente?'
  },
  'register.businessOwner': {
    en: 'Business owner',
    es: 'Dueño de negocio'
  },
  'register.client': {
    en: 'Client',
    es: 'Cliente'
  },
  'register.businessNameLabel': {
    en: 'Business name',
    es: 'Nombre de tu negocio'
  },
  'register.businessNamePlaceholder': {
    en: 'e.g. Pet Esthetic Bayamón',
    es: 'Ej: Pet Esthetic Bayamón'
  },
  'register.choosePlan': {
    en: 'Choose your subscription plan',
    es: 'Elige tu plan de suscripción'
  },
  'register.planStarter': {
    en: 'Free Starter',
    es: 'Starter gratuito'
  },
  'register.planStarterDesc': {
    en: 'Limited functionality (no limits applied yet)',
    es: 'Funcionalidad limitada (por ahora sin límites)'
  },
  'register.planBasic': {
    en: 'Basic',
    es: 'Básico'
  },
  'register.planPro': {
    en: 'Pro',
    es: 'Pro'
  },
  'register.planEnterprise': {
    en: 'Enterprise',
    es: 'Empresarial'
  },
  'register.planBasicDesc': {
    en: 'For small grooming businesses',
    es: 'Para negocios de grooming pequeños'
  },
  'register.planProDesc': {
    en: 'Ideal for growing businesses',
    es: 'Ideal para negocios en crecimiento'
  },
  'register.planEnterpriseDesc': {
    en: 'For large operations',
    es: 'Para operaciones grandes'
  },
  'register.fullName': {
    en: 'Full name',
    es: 'Nombre completo'
  },
  'register.createAccount': {
    en: 'Create account',
    es: 'Crear cuenta'
  },
  'register.creating': {
    en: 'Creating...',
    es: 'Creando...'
  },
  'register.next': {
    en: 'Next',
    es: 'Siguiente'
  },
  'register.back': {
    en: 'Back',
    es: 'Atrás'
  },
  'register.checkEmail': {
    en: 'Check your email',
    es: 'Revisa tu correo'
  },
  'register.checkEmailMessage': {
    en: 'We sent you a confirmation link. Click it to activate your account, then you will be redirected to your dashboard.',
    es: 'Te enviamos un enlace de confirmación. Haz clic para activar tu cuenta; luego serás redirigido a tu panel.'
  },
  'register.hasAccount': {
    en: 'Already have an account?',
    es: '¿Ya tienes cuenta?'
  },
  'register.signInHere': {
    en: 'Sign in here',
    es: 'Inicia sesión aquí'
  },
  'register.errorGeneric': {
    en: 'Something went wrong. Please try again.',
    es: 'Algo salió mal. Intenta de nuevo.'
  },
  'register.errorEmailInUse': {
    en: 'This email is already registered.',
    es: 'Este correo ya está registrado.'
  },

  // Logout dialog
  'logout.title': {
    en: 'Log out',
    es: 'Cerrar sesión'
  },
  'logout.confirm': {
    en: 'Are you sure you want to log out of Stratum Hub?',
    es: '¿Seguro que quieres cerrar sesión en Stratum Hub?'
  },
  'logout.cancel': {
    en: 'Cancel',
    es: 'Cancelar'
  },
  'logout.confirmButton': {
    en: 'Log out',
    es: 'Cerrar sesión'
  },
  'logout.success': {
    en: 'You have been signed out',
    es: 'Sesión cerrada'
  },

  // Client placeholder
  'clientPlaceholder.title': {
    en: 'Client portal',
    es: 'Portal de clientes'
  },
  'clientPlaceholder.comingSoon': {
    en: 'Coming soon',
    es: 'Próximamente'
  },
  'clientPlaceholder.message': {
    en: 'The client portal is under construction. You can sign out and return later.',
    es: 'El portal de clientes está en construcción. Puedes cerrar sesión y volver más tarde.'
  },

  // Navigation
  'nav.dashboard': {
    en: 'Dashboard',
    es: 'Dashboard'
  },
  'nav.clients': {
    en: 'Clients',
    es: 'Clientes'
  },
  'nav.pets': {
    en: 'Pets',
    es: 'Mascotas'
  },
  'nav.appointments': {
    en: 'Appointments',
    es: 'Citas'
  },
  'nav.inventory': {
    en: 'Inventory',
    es: 'Inventario'
  },
  'nav.timeTracking': {
    en: 'Time Tracking',
    es: 'Registro de Tiempo'
  },
  'nav.employees': {
    en: 'Employees',
    es: 'Empleados'
  },
  'nav.employeeInfo': {
    en: 'Employee Info',
    es: 'Información de Empleado'
  },
  'nav.schedule': {
    en: 'Schedule',
    es: 'Horario'
  },
  'nav.reports': {
    en: 'Reports',
    es: 'Reportes'
  },
  'nav.analytics': {
    en: 'Analytics',
    es: 'Análisis'
  },
  'nav.payroll': {
    en: 'Payroll',
    es: 'Nómina'
  },
  'nav.more': {
    en: 'More',
    es: 'Más'
  },
  'nav.services': {
    en: 'Services',
    es: 'Servicios'
  },
  'nav.personalization': {
    en: 'Personalization',
    es: 'Personalización'
  },
  
  // Personalization page
  'personalization.title': {
    en: 'Personalization',
    es: 'Personalización'
  },
  'personalization.description': {
    en: 'Configure your business preferences and branding',
    es: 'Configura las preferencias y marca de tu negocio'
  },
  'personalization.businessName': {
    en: 'Business Name',
    es: 'Nombre del Negocio'
  },
  'personalization.businessHours': {
    en: 'Business Hours',
    es: 'Horario de Negocio'
  },
  'personalization.colorCustomization': {
    en: 'Color Customization',
    es: 'Personalización de Colores'
  },
  'personalization.primaryColor': {
    en: 'Primary Color',
    es: 'Color Principal'
  },
  'personalization.primaryColorDesc': {
    en: 'Main brand color used throughout the app',
    es: 'Color principal de marca usado en toda la aplicación'
  },
  'personalization.secondaryColor': {
    en: 'Secondary Color',
    es: 'Color Secundario'
  },
  'personalization.secondaryColorDesc': {
    en: 'Secondary accent color for highlights and accents',
    es: 'Color de acento secundario para resaltes y acentos'
  },
  'personalization.language': {
    en: 'Language',
    es: 'Idioma'
  },
  'personalization.selectLanguage': {
    en: 'Select Language',
    es: 'Seleccionar Idioma'
  },
  'personalization.saveSettings': {
    en: 'Save Settings',
    es: 'Guardar Configuración'
  },
  'personalization.saving': {
    en: 'Saving...',
    es: 'Guardando...'
  },
  'personalization.settingsSaved': {
    en: 'Settings saved successfully!',
    es: '¡Configuración guardada exitosamente!'
  },
  'personalization.settingsError': {
    en: 'Failed to save settings. Please try again.',
    es: 'Error al guardar la configuración. Por favor intente de nuevo.'
  },
  
  // Common actions
  'common.add': {
    en: 'Add',
    es: 'Agregar'
  },
  'common.cancel': {
    en: 'Cancel',
    es: 'Cancelar'
  },
  'common.save': {
    en: 'Save',
    es: 'Guardar'
  },
  'common.saving': {
    en: 'Saving...',
    es: 'Guardando...'
  },
  'common.edit': {
    en: 'Edit',
    es: 'Editar'
  },
  'common.delete': {
    en: 'Delete',
    es: 'Eliminar'
  },
  'common.search': {
    en: 'Search',
    es: 'Buscar'
  },
  'common.new': {
    en: 'New',
    es: 'Nuevo'
  },
  'common.welcome': {
    en: 'Welcome to your Hub!',
    es: 'Bienvenido a tu Hub!'
  },
  
  // Clients page
  'clients.title': {
    en: 'Clients',
    es: 'Clientes'
  },
  'clients.description': {
    en: 'Manage your grooming clients and their information',
    es: 'Administra tus clientes de aseo y su información'
  },
  'clients.addClient': {
    en: 'Add Client',
    es: 'Agregar Cliente'
  },
  'clients.searchPlaceholder': {
    en: 'Search clients by name, email, or phone...',
    es: 'Buscar clientes por nombre, correo o teléfono...'
  },
  'clients.saveError': {
    en: 'Could not save client. Please try again.',
    es: 'No se pudo guardar el cliente. Por favor intente de nuevo.'
  },
  'clients.saveSuccess': {
    en: 'Client saved successfully.',
    es: 'Cliente guardado exitosamente.'
  },
  'clients.updateSuccess': {
    en: 'Client updated successfully.',
    es: 'Cliente actualizado exitosamente.'
  },
  
  // Pets page
  'pets.title': {
    en: 'Pets',
    es: 'Mascotas'
  },
  'pets.description': {
    en: 'Keep track of all the furry friends in your care',
    es: 'Lleva al día todas las mascotitas que pasan por tu grooming'
  },
  'pets.addPet': {
    en: 'Add Pet',
    es: 'Agregar Mascota'
  },
  'pets.addClientFirst': {
    en: 'Add a client first before adding pets.',
    es: 'Agrega un cliente primero antes de agregar mascotas.'
  },
  'pets.searchPlaceholder': {
    en: 'Search pets by name, breed, or owner...',
    es: 'Buscar mascotas por nombre, raza o dueño...'
  },
  'pets.species': {
    en: 'Species',
    es: 'Especie'
  },
  'pets.dogs': {
    en: 'Dogs',
    es: 'Perros'
  },
  'pets.cats': {
    en: 'Cats',
    es: 'Gatos'
  },
  'pets.other': {
    en: 'Other',
    es: 'Otro'
  },
  'pets.unknownOwner': {
    en: 'Unknown owner',
    es: 'Dueño desconocido'
  },
  'pets.notAssigned': {
    en: 'No owner assigned',
    es: 'Sin dueño asignado'
  },
  'pets.clickToViewOwner': {
    en: 'Click to open client',
    es: 'Toca para abrir el cliente'
  },
  'pets.yearsOld': {
    en: '{count} yrs',
    es: '{count} años'
  },
  'pets.lbs': {
    en: 'lbs',
    es: 'lbs'
  },
  
  // Appointments page
  'appointments.title': {
    en: 'Appointments',
    es: 'Citas'
  },
  'appointments.description': {
    en: 'Schedule and manage client appointments',
    es: 'Programa y administra citas de clientes'
  },
  'appointments.newAppointment': {
    en: 'New Appointment',
    es: 'Nueva Cita'
  },
  'appointments.bookingLink': {
    en: 'Booking Link',
    es: 'Enlace de Reserva'
  },
  'appointments.unassigned': {
    en: 'Unassigned',
    es: 'Sin asignar'
  },
  'appointments.unknownPet': {
    en: 'Unknown Pet',
    es: 'Mascota Desconocida'
  },
  'appointments.unknownClient': {
    en: 'Unknown Client',
    es: 'Cliente Desconocido'
  },
  
  // Services page
  'services.title': {
    en: 'Services',
    es: 'Servicios'
  },
  'services.description': {
    en: 'Manage your service offerings and pricing',
    es: 'Administra tus ofertas de servicios y precios'
  },
  'services.addService': {
    en: 'Add Service',
    es: 'Agregar Servicio'
  },
  
  // Inventory page
  'inventory.title': {
    en: 'Inventory',
    es: 'Inventario'
  },
  'inventory.description': {
    en: 'Manage your product inventory and stock levels',
    es: 'Administra tu inventario de productos y niveles de stock'
  },
  
  // Employees/Time Tracking page
  'timeTracking.title': {
    en: 'Time Clock',
    es: 'Reloj de Tiempo'
  },
  'timeTracking.description': {
    en: 'Enter your PIN to clock in or out',
    es: 'Ingresa tu PIN para entrar o salir'
  },
  'timeTracking.employeeVerification': {
    en: 'Employee Verification',
    es: 'Verificación de Empleado'
  },
  'timeTracking.welcome': {
    en: 'Welcome, {name}',
    es: 'Bienvenido, {name}'
  },
  'timeTracking.readyToClock': {
    en: 'Ready to clock in/out',
    es: 'Listo para entrar/salir'
  },
  'timeTracking.enterPin': {
    en: 'Enter your 4-digit PIN',
    es: 'Ingresa tu PIN de 4 dígitos'
  },
  'timeTracking.enterPinPlaceholder': {
    en: 'Enter PIN',
    es: 'Ingrese PIN'
  },
  'timeTracking.verify': {
    en: 'Verify',
    es: 'Verificar'
  },
  'timeTracking.clockIn': {
    en: 'Clock In',
    es: 'Entrar'
  },
  'timeTracking.clockOut': {
    en: 'Clock Out',
    es: 'Salir'
  },
  'timeTracking.logout': {
    en: 'Logout',
    es: 'Cerrar Sesión'
  },
  'timeTracking.invalidPin': {
    en: 'Invalid PIN. Please try again.',
    es: 'PIN inválido. Por favor intente de nuevo.'
  },
  'timeTracking.clockedIn': {
    en: '{name} clocked in successfully!',
    es: '¡{name} entró exitosamente!'
  },
  'timeTracking.clockedOut': {
    en: '{name} clocked out successfully!',
    es: '¡{name} salió exitosamente!'
  },
  'timeTracking.todaysEntries': {
    en: "Today's Entries",
    es: 'Entradas de Hoy'
  },
  
  // Dashboard
  'dashboard.totalClients': {
    en: 'Total Clients',
    es: 'Total de Clientes'
  },
  'dashboard.registeredClients': {
    en: 'Registered clients',
    es: 'Clientes registrados'
  },
  'dashboard.totalPets': {
    en: 'Total Pets',
    es: 'Total de Mascotas'
  },
  'dashboard.dogs': {
    en: 'dogs',
    es: 'perros'
  },
  'dashboard.cats': {
    en: 'cats',
    es: 'gatos'
  },
  'dashboard.activeStaff': {
    en: 'Active Staff',
    es: 'Personal Activo'
  },
  'dashboard.teamMembers': {
    en: 'Team members',
    es: 'Miembros del equipo'
  },
  'dashboard.today': {
    en: 'Today',
    es: 'Hoy'
  },
  'dashboard.appointments': {
    en: 'Appointments',
    es: 'Citas'
  },
  'dashboard.revenue': {
    en: 'Revenue',
    es: 'Ingresos'
  },
  'dashboard.totalEarned': {
    en: 'Total earned',
    es: 'Total ganado'
  },
  'dashboard.welcome': {
    en: 'Welcome to your Hub',
    es: 'Bienvenido a tu Centro'
  },
  'dashboard.overview': {
    en: 'Here is an overview of your business',
    es: 'Aquí está un resumen de tu negocio'
  },
  'dashboard.growth': {
    en: 'Growth',
    es: 'Crecimiento'
  },
  'dashboard.vsLastMonth': {
    en: 'vs last month',
    es: 'vs mes pasado'
  },
  'dashboard.todaysAppointments': {
    en: "Today's Appointments",
    es: 'Citas de Hoy'
  },
  'dashboard.recentClients': {
    en: 'Recent Clients',
    es: 'Clientes Recientes'
  },
  'dashboard.recentPets': {
    en: 'Recent Pets',
    es: 'Mascotas Recientes'
  },
  'dashboard.viewAll': {
    en: 'View All',
    es: 'Ver Todo'
  },
  'dashboard.noAppointmentsToday': {
    en: 'No appointments scheduled for today',
    es: 'No hay citas programadas para hoy'
  },
  'timeTracking.switchUser': {
    en: 'Switch User',
    es: 'Cambiar Usuario'
  },
  'timeTracking.currentlyClockedIn': {
    en: 'Currently clocked in since',
    es: 'Actualmente entró desde'
  },
  'timeTracking.todaysActivity': {
    en: "Today's Activity",
    es: 'Actividad de Hoy'
  },
  'common.copy': {
    en: 'Copy',
    es: 'Copiar'
  },
  'common.copied': {
    en: 'Copied!',
    es: '¡Copiado!'
  },
  'appointments.shareableBookingLink': {
    en: 'Shareable Booking Link',
    es: 'Enlace de Reserva Compartible'
  },
  'appointments.shareLinkDescription': {
    en: 'Share this link with clients so they can book appointments directly',
    es: 'Comparte este enlace con los clientes para que puedan reservar citas directamente'
  },
  'dashboard.noClientsYet': {
    en: 'No clients yet',
    es: 'Aún no hay clientes'
  },
  'dashboard.noPetsYet': {
    en: 'No pets yet',
    es: 'Aún no hay mascotas'
  },
  'dashboard.pets': {
    en: 'pets',
    es: 'mascotas'
  },
  'dashboard.unknownOwner': {
    en: 'Unknown owner',
    es: 'Dueño desconocido'
  },
  
  // Inventory page (already defined above)
  'inventory.addProduct': {
    en: 'Add Product',
    es: 'Agregar Producto'
  },
  'inventory.scanBarcode': {
    en: 'Scan Barcode',
    es: 'Escanear Código de Barras'
  },
  'inventory.editProduct': {
    en: 'Edit Product',
    es: 'Editar Producto'
  },
  
  // Employee Management page
  'employeeManagement.title': {
    en: 'Employee Management',
    es: 'Gestión de Empleados'
  },
  'employeeManagement.description': {
    en: 'Add, edit, and manage your team members',
    es: 'Agrega, edita y administra los miembros de tu equipo'
  },
  'employeeManagement.addEmployee': {
    en: 'Add Employee',
    es: 'Agregar Empleado'
  },
  'employeeManagement.editEmployee': {
    en: 'Edit Employee',
    es: 'Editar Empleado'
  },
  'employeeManagement.addNewEmployee': {
    en: 'Add New Employee',
    es: 'Agregar Nuevo Empleado'
  },
  'employeeManagement.noEmployeesYet': {
    en: 'No employees yet. Add your first employee above!',
    es: 'Aún no hay empleados. ¡Agrega tu primer empleado arriba!'
  },
  'employeeManagement.deleteEmployee': {
    en: 'Delete Employee',
    es: 'Eliminar Empleado'
  },
  'employeeManagement.deleteConfirm': {
    en: 'Are you sure you want to delete this employee? This action cannot be undone.',
    es: '¿Estás seguro de que quieres eliminar este empleado? Esta acción no se puede deshacer.'
  },
  'inventory.addNewProduct': {
    en: 'Add New Product',
    es: 'Agregar Nuevo Producto'
  },
  'inventory.updateProduct': {
    en: 'Update Product',
    es: 'Actualizar Producto'
  },
  
  // Form fields
  'form.fullName': {
    en: 'Full Name',
    es: 'Nombre Completo'
  },
  'form.email': {
    en: 'Email',
    es: 'Correo Electrónico'
  },
  'form.phone': {
    en: 'Phone',
    es: 'Teléfono'
  },
  'form.address': {
    en: 'Address',
    es: 'Dirección'
  },
  'form.addressOptional': {
    en: 'Address (Optional)',
    es: 'Dirección (Opcional)'
  },
  'form.notes': {
    en: 'Notes',
    es: 'Notas (lo que te quieras acordar)'
  },
  'form.owner': {
    en: 'Owner',
    es: 'Dueño'
  },
  'form.selectOwner': {
    en: 'Select owner',
    es: 'Escoge el dueño'
  },
  'form.noCustomersAvailable': {
    en: 'No clients available yet',
    es: 'Todavía no tienes clientes creados'
  },
  'form.petName': {
    en: 'Pet Name',
    es: 'Nombre de Mascota'
  },
  'form.species': {
    en: 'Species',
    es: 'Especie'
  },
  'form.breed': {
    en: 'Breed',
    es: 'Raza'
  },
  'form.age': {
    en: 'Age',
    es: 'Edad'
  },
  'form.weight': {
    en: 'Weight',
    es: 'Peso'
  },
  'form.paymentDetails': {
    en: 'Payment Details (Optional)',
    es: 'Detalles de Pago (Opcional)'
  },
  'form.paymentDetailsDesc': {
    en: 'These details can be saved from checkout.',
    es: 'Estos detalles se pueden guardar desde el pago.'
  },
  'form.cardNumber': {
    en: 'Card Number',
    es: 'Número de Tarjeta'
  },
  'form.cardName': {
    en: 'Cardholder Name',
    es: 'Nombre del Titular'
  },
  'form.cardExpiry': {
    en: 'Expiry (MM/YY)',
    es: 'Vencimiento (MM/AA)'
  },
  'form.cardCvv': {
    en: 'CVV',
    es: 'CVV'
  },
  'form.editClient': {
    en: 'Edit Client',
    es: 'Editar Cliente'
  },
  'form.addNewClient': {
    en: 'Add New Client',
    es: 'Agregar Nuevo Cliente'
  },
  'form.editPet': {
    en: 'Edit Pet',
    es: 'Editar Mascota'
  },
  'form.addNewPet': {
    en: 'Add New Pet',
    es: 'Agregar Nueva Mascota'
  },
  'form.clientName': {
    en: 'Client Name',
    es: 'Nombre del Cliente'
  },
  'form.selectClient': {
    en: 'Select Client',
    es: 'Seleccionar Cliente'
  },
  'form.selectClientOrCreate': {
    en: 'Select Client or Create New',
    es: 'Seleccionar Cliente o Crear Nuevo'
  },
  'form.createNewClient': {
    en: 'Create New Client',
    es: 'Crear Nuevo Cliente'
  },
  'form.selectPet': {
    en: 'Select Pet',
    es: 'Seleccionar Mascota'
  },
  'form.selectPetOrCreate': {
    en: 'Select Pet or Create New',
    es: 'Seleccionar Mascota o Crear Nueva'
  },
  'form.selectDate': {
    en: 'Select Date',
    es: 'Seleccionar Fecha'
  },
  'form.selectTime': {
    en: 'Select Time',
    es: 'Seleccionar Hora'
  },
  'form.servicesNeeded': {
    en: 'Services Needed',
    es: 'Servicios Necesarios'
  },
  'form.additionalNotes': {
    en: 'Additional Notes (Optional)',
    es: 'Notas Adicionales (Opcional)'
  },
  'form.createAppointment': {
    en: 'Create Appointment',
    es: 'Crear Cita'
  },
  'form.updateAppointment': {
    en: 'Update Appointment',
    es: 'Actualizar Cita'
  },
  'form.creating': {
    en: 'Creating...',
    es: 'Creando...'
  },
  'form.updating': {
    en: 'Updating...',
    es: 'Actualizando...'
  },
  'form.assignEmployee': {
    en: 'Assign Employee (Optional)',
    es: 'Asignar Empleado (Opcional)'
  },
  'form.selectEmployee': {
    en: 'Select an employee',
    es: 'Seleccionar un empleado'
  },
  'form.status': {
    en: 'Status',
    es: 'Estado'
  },
  'form.price': {
    en: 'Price ($)',
    es: 'Precio ($)'
  },
  'form.serviceName': {
    en: 'Service Name',
    es: 'Nombre del Servicio'
  },
  'form.category': {
    en: 'Category',
    es: 'Categoría'
  },
  'form.description': {
    en: 'Description',
    es: 'Descripción'
  },
  'form.duration': {
    en: 'Duration (minutes)',
    es: 'Duración (minutos)'
  },
  'form.cost': {
    en: 'Cost',
    es: 'Costo'
  },
  'form.updateService': {
    en: 'Update Service',
    es: 'Actualizar Servicio'
  },
  'form.vaccinationStatus': {
    en: 'Vaccination Status',
    es: 'Estado de Vacunación'
  },
  'form.vaccinationStatus.unknown': {
    en: 'Unknown',
    es: 'Desconocido'
  },
  'form.vaccinationStatus.uptodate': {
    en: 'Up to Date',
    es: 'Al Día'
  },
  'form.vaccinationStatus.overdue': {
    en: 'Overdue',
    es: 'Vencido'
  },
  'form.vaccinationStatus.pending': {
    en: 'Pending',
    es: 'Pendiente'
  },
  
  // Appointments page additional
  'appointments.calendar': {
    en: 'Calendar',
    es: 'Calendario'
  },
  'appointments.weekView': {
    en: 'Week View',
    es: 'Vista Semanal'
  },
  'appointments.monthView': {
    en: 'Month View',
    es: 'Vista Mensual'
  },
  'appointments.today': {
    en: 'Today',
    es: 'Hoy'
  },
  'appointments.noAppointments': {
    en: 'No appointments',
    es: 'Sin citas'
  },
  'appointments.more': {
    en: 'more',
    es: 'más'
  },
  'appointments.selectDate': {
    en: 'Select a date',
    es: 'Selecciona una fecha'
  },
  'appointments.noAppointmentsScheduled': {
    en: 'No appointments scheduled',
    es: 'No hay citas programadas'
  },
  'appointments.serviceType': {
    en: 'Service Type',
    es: 'Tipo de Servicio'
  },
  'appointments.estimatedPrice': {
    en: 'Estimated Price',
    es: 'Precio Estimado'
  },
  'appointments.deleteConfirm': {
    en: 'This will permanently delete this appointment. This action cannot be undone.',
    es: 'Esto eliminará permanentemente esta cita. Esta acción no se puede deshacer.'
  },
  'appointments.checkout': {
    en: 'Checkout',
    es: 'Pago'
  },
  
  // Employee Schedule page
  'schedule.title': {
    en: 'Employee Schedule',
    es: 'Horario de Empleados'
  },
  'schedule.description': {
    en: 'Overview of employee shifts for the week',
    es: 'Resumen de turnos de empleados para la semana'
  },
  'schedule.employee': {
    en: 'Employee',
    es: 'Empleado'
  },
  'schedule.totalHours': {
    en: 'Total Hours',
    es: 'Horas Totales'
  },
  'schedule.clockIn': {
    en: 'Clock In',
    es: 'Entrada'
  },
  'schedule.clockOut': {
    en: 'Clock Out',
    es: 'Salida'
  },
  'schedule.hours': {
    en: 'Hours',
    es: 'Horas'
  },
  'schedule.noEntries': {
    en: 'No entries',
    es: 'Sin entradas'
  },
  'schedule.monthView': {
    en: 'Month View',
    es: 'Vista Mensual'
  },
  'schedule.weekOf': {
    en: 'Week of',
    es: 'Semana del'
  },
  'schedule.noActiveEmployees': {
    en: 'No active employees found.',
    es: 'No se encontraron empleados activos.'
  },
  
  // Payroll page
  'payroll.title': {
    en: 'Payroll',
    es: 'Nómina'
  },
  'payroll.description': {
    en: 'Manage employee payroll and time entries',
    es: 'Administre la nómina de empleados y entradas de tiempo'
  },
  'payroll.employee': {
    en: 'Employee',
    es: 'Empleado'
  },
  'payroll.hoursWorked': {
    en: 'Hours Worked',
    es: 'Horas Trabajadas'
  },
  'payroll.hourlyRate': {
    en: 'Hourly Rate',
    es: 'Tarifa por Hora'
  },
  'payroll.totalPay': {
    en: 'Total Pay',
    es: 'Pago Total'
  },
  'payroll.payPeriod': {
    en: 'Pay Period',
    es: 'Período de Pago'
  },
  'payroll.editEntry': {
    en: 'Edit Entry',
    es: 'Editar Entrada'
  },
  'payroll.addEntry': {
    en: 'Add Entry',
    es: 'Agregar Entrada'
  },
  'payroll.clockIn': {
    en: 'Clock In',
    es: 'Hora de Entrada'
  },
  'payroll.clockOut': {
    en: 'Clock Out',
    es: 'Hora de Salida'
  },
  'payroll.save': {
    en: 'Save',
    es: 'Guardar'
  },
  'payroll.cancel': {
    en: 'Cancel',
    es: 'Cancelar'
  },
  'payroll.previousPayPeriod': {
    en: 'Previous Pay Period',
    es: 'Período de Pago Anterior'
  },
  'payroll.nextPayPeriod': {
    en: 'Next Pay Period',
    es: 'Siguiente Período de Pago'
  },
  'payroll.currentPayPeriod': {
    en: 'Current Pay Period',
    es: 'Período de Pago Actual'
  },
  'payroll.payPeriodSummary': {
    en: 'Pay Period Summary',
    es: 'Resumen del Período de Pago'
  },
  'payroll.role': {
    en: 'Role',
    es: 'Rol'
  },
  
  // Reports/Analytics page
  'reports.title': {
    en: 'Analytics & Reports',
    es: 'Análisis y Reportes'
  },
  'reports.description': {
    en: 'View business insights and analytics',
    es: 'Ver información y análisis del negocio'
  },
  'reports.speciesDistribution': {
    en: 'Species Distribution',
    es: 'Distribución de Especies'
  },
  'reports.weeklyRegistrations': {
    en: 'Weekly Registrations',
    es: 'Registros Semanales'
  },
  'reports.appointmentStatus': {
    en: 'Appointment Status',
    es: 'Estado de Citas'
  },
  'reports.revenueTrend': {
    en: 'Revenue Trend',
    es: 'Tendencia de Ingresos'
  },
  'reports.employeeHours': {
    en: 'Employee Hours',
    es: 'Horas de Empleados'
  },
  'reports.clients': {
    en: 'Clients',
    es: 'Clientes'
  },
  'reports.pets': {
    en: 'Pets',
    es: 'Mascotas'
  },
  'reports.revenue': {
    en: 'Revenue',
    es: 'Ingresos'
  },
  'reports.hours': {
    en: 'Hours',
    es: 'Horas'
  },
  'reports.totalRevenue': {
    en: 'Total Revenue',
    es: 'Ingresos Totales'
  },
  'reports.hoursWorked': {
    en: 'Hours Worked',
    es: 'Horas Trabajadas'
  },
  'reports.payrollWeek': {
    en: 'Payroll (Week)',
    es: 'Nómina (Semana)'
  },
  'reports.revenueLast7Days': {
    en: 'Revenue (Last 7 Days)',
    es: 'Ingresos (Últimos 7 Días)'
  },
  'reports.scheduled': {
    en: 'Scheduled',
    es: 'Programadas'
  },
  'reports.completed': {
    en: 'Completed',
    es: 'Completadas'
  },
  'reports.inProgress': {
    en: 'In Progress',
    es: 'En Progreso'
  },
  'reports.cancelled': {
    en: 'Cancelled',
    es: 'Canceladas'
  },
  'reports.noPetData': {
    en: 'No pet data yet',
    es: 'Aún no hay datos de mascotas'
  },
  'reports.newClientsPetsThisWeek': {
    en: 'New clients and pets this week',
    es: 'Nuevos clientes y mascotas esta semana'
  },
  'reports.hoursWorkedByStaff': {
    en: 'Hours worked by active staff',
    es: 'Horas trabajadas por personal activo'
  },
  'reports.noEmployeeData': {
    en: 'No employee data yet',
    es: 'Aún no hay datos de empleados'
  },
  'reports.petDistribution': {
    en: 'Pet Distribution',
    es: 'Distribución de Mascotas'
  },
  
  // Employee Timesheet page
  'timesheet.title': {
    en: 'Timesheet',
    es: 'Hoja de Tiempo'
  },
  'timesheet.backToPayroll': {
    en: 'Back to Payroll',
    es: 'Volver a Nómina'
  },
  'timesheet.employeeNotFound': {
    en: 'Employee Not Found',
    es: 'Empleado No Encontrado'
  },
  'timesheet.detailedRecords': {
    en: 'Detailed timekeeping records and hours worked',
    es: 'Registros detallados de tiempo y horas trabajadas'
  },
  'timesheet.timesheetDetails': {
    en: 'Timesheet Details',
    es: 'Detalles de Hoja de Tiempo'
  },
  'timesheet.twoWeekBreakdown': {
    en: 'Two-week pay period breakdown by day',
    es: 'Desglose del período de pago de dos semanas por día'
  },
  'timesheet.dateDay': {
    en: 'Date/Day',
    es: 'Fecha/Día'
  },
  'timesheet.hoursWorked': {
    en: 'Hours Worked',
    es: 'Horas Trabajadas'
  },
  'timesheet.pay': {
    en: 'Pay',
    es: 'Pago'
  },
  'timesheet.totalHours': {
    en: 'Total Hours',
    es: 'Horas Totales'
  },
  'timesheet.hourlyRate': {
    en: 'Hourly Rate',
    es: 'Tarifa por Hora'
  },
  'timesheet.grossPay': {
    en: 'Gross Pay',
    es: 'Pago Bruto'
  },
  
  // Pet singular/plural
  'pets.pet': {
    en: 'pet',
    es: 'mascota'
  },
  'pets.pets': {
    en: 'pets',
    es: 'mascotas'
  },
  'form.petInformation': {
    en: 'Pet Information',
    es: 'Información de Mascota'
  },
  'form.clientInformation': {
    en: 'Client Information',
    es: 'Información del Cliente'
  },
  'form.selectExistingClient': {
    en: 'Select existing client',
    es: 'Seleccionar cliente existente'
  },
  'form.selectExistingPet': {
    en: 'Select existing pet',
    es: 'Seleccionar mascota existente'
  },
  
  // Payroll Employee Timesheet section
  'payroll.employeeTimesheet': {
    en: 'Employee Timesheet',
    es: 'Hoja de Tiempo del Empleado'
  },
  'payroll.viewAndAmendDescription': {
    en: 'View and amend employee timesheet entries for the selected week',
    es: 'Ver y corregir entradas de hoja de tiempo del empleado para la semana seleccionada'
  },
  'payroll.selectEmployee': {
    en: 'Select Employee',
    es: 'Seleccionar Empleado'
  },
  'payroll.chooseEmployee': {
    en: 'Choose an employee...',
    es: 'Elige un empleado...'
  },
  'payroll.timesheetFor': {
    en: 'Timesheet for',
    es: 'Hoja de tiempo para'
  },
  'payroll.action': {
    en: 'Action',
    es: 'Acción'
  },
  'payroll.amend': {
    en: 'Amend',
    es: 'Corregir'
  },
  'payroll.selectEmployeeToView': {
    en: 'Select an employee to view their timesheet',
    es: 'Selecciona un empleado para ver su hoja de tiempo'
  },
  'payroll.amendTimesheetEntry': {
    en: 'Amend Timesheet Entry',
    es: 'Corregir Entrada de Hoja de Tiempo'
  },
  'payroll.addTimesheetEntry': {
    en: 'Add Timesheet Entry',
    es: 'Agregar Entrada de Hoja de Tiempo'
  },
  'payroll.correctTimesDescription': {
    en: 'Correct the clock-in and clock-out times for {date}',
    es: 'Corrige las horas de entrada y salida para {date}'
  },
  'payroll.addNewEntryDescription': {
    en: 'Add a new clock-in/clock-out entry for {date}',
    es: 'Agregar una nueva entrada de entrada/salida para {date}'
  },
  'payroll.multipleEntriesNote': {
    en: 'Note: This day has multiple entries. You are editing the first entry. To edit other entries, close this dialog and click "Amend" again after saving.',
    es: 'Nota: Este día tiene múltiples entradas. Está editando la primera entrada. Para editar otras entradas, cierre este diálogo y haga clic en "Corregir" nuevamente después de guardar.'
  },
  'payroll.leaveEmptyIfClockedIn': {
    en: 'Leave empty if employee is still clocked in',
    es: 'Deje vacío si el empleado aún está registrado'
  },
};

let currentLanguage: Language = 'es';

export const setLanguage = (lang: Language) => {
  currentLanguage = lang;
  localStorage.setItem('language', lang);
  // Dispatch event to notify components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('languagechange'));
  }
};

export const getLanguage = (): Language => {
  const stored = localStorage.getItem('language') as Language;
  // Default to Spanish (es) for Puerto Rico audience when nothing is stored
  return stored || 'es';
};

export const t = (key: string, params?: Record<string, string | number>): string => {
  const translation = translations[key];
  if (!translation) {
    console.warn(`Translation missing for key: ${key}`);
    return key;
  }
  const lang = getLanguage();
  let text = translation[lang] || translation.en || key;
  
  // Replace placeholders like {name} with actual values
  if (params) {
    Object.keys(params).forEach(param => {
      text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(params[param]));
    });
  }
  
  return text;
};

// Initialize language from localStorage
if (typeof window !== 'undefined') {
  currentLanguage = getLanguage();
}
