import { DEMO_LANGUAGE_STORAGE_KEY, isDemoMode } from '@/lib/authRouting';
import { devConsole } from '@/lib/clientDebug';

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
    en: 'Streamline your grooming business with powerful scheduling, client management, and revenue tracking tools. Start your free trial today.',
    es: 'Optimiza tu negocio de grooming con herramientas poderosas de citas, manejo de clientes y seguimiento de ingresos. Comienza tu prueba gratis hoy.'
  },
  'landing.login': {
    en: 'Login',
    es: 'Login'
  },
  'landing.getStarted': {
    en: 'Get Started',
    es: 'Registro'
  },
  'landing.startFreeTrial': {
    en: 'Sign Up',
    es: 'Regístrate'
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
    es: 'Planes de Subscripción'
  },
  // Splash hero (premium landing) — two lines, fixed break for all screen sizes
  'landing.splashHeadline': {
    en: 'Transform How You Run Your Pet Business',
    es: 'Transforma Cómo Gestionas Tu Negocio de Mascotas'
  },
  'landing.splashHeadlineLine1': {
    en: 'Transform How You Run',
    es: 'Transforma cómo gestionas'
  },
  'landing.splashHeadlineLine2': {
    en: 'Your Pet Business',
    es: 'tu negocio de mascotas'
  },
  'landing.splashHeadline.1': { en: 'Transform', es: 'Transforma' },
  'landing.splashHeadline.2': { en: 'How', es: 'Cómo' },
  'landing.splashHeadline.3': { en: 'You', es: 'Gestionas' },
  'landing.splashHeadline.4': { en: 'Run', es: 'Tu' },
  'landing.splashHeadline.5': { en: 'Your', es: 'Negocio' },
  'landing.splashHeadline.6': { en: 'Pet', es: 'de' },
  'landing.splashHeadline.7': { en: 'Business', es: 'Mascotas' },
  'landing.splashSubheadline': {
    en: 'Save hours every week with software built specifically for your industry.',
    es: 'Ahorra horas cada semana con software hecho específicamente para tu industria.'
  },
  'landing.navFeatures': {
    en: 'Features',
    es: 'Características'
  },
  'landing.navWhyPetHub': {
    en: 'Why Grumi',
    es: 'Por Qué Grumi'
  },
  'landing.navPricing': {
    en: 'Pricing',
    es: 'Precios'
  },
  'pricing.heroEyebrow': {
    en: 'Pricing',
    es: 'Precios',
  },
  'pricing.heroTitle': {
    en: 'Start free. Scale with confidence.',
    es: 'Empieza gratis. Crece con confianza.',
  },
  'pricing.heroSubtitle': {
    en: 'Pay only as your pet care business grows.',
    es: 'Paga solo a medida que crece tu negocio de mascotas.',
  },
  'pricing.heroTrialNote': {
    en: 'All plans include a 14-day free trial. No credit card required.',
    es: 'Todos los planes incluyen 14 días de prueba gratis. Sin tarjeta de crédito.',
  },
  'pricing.billingGroupAria': {
    en: 'Billing period',
    es: 'Periodo de facturación',
  },
  'pricing.billingMonthly': {
    en: 'Monthly billing',
    es: 'Facturación mensual',
  },
  'pricing.billingAnnual': {
    en: 'Annual billing',
    es: 'Facturación anual',
  },
  'pricing.billingSaveNote': {
    en: '(Save 15%)',
    es: '(Ahorra 15%)',
  },
  'pricing.billingAnnualAria': {
    en: 'Annual billing — Save 15%',
    es: 'Facturación anual — Ahorra 15%',
  },
  'pricing.billingMonthlyAria': {
    en: 'Monthly billing',
    es: 'Facturación mensual',
  },
  'pricing.comparePlansButton': {
    en: 'Compare plans in detail',
    es: 'Comparar planes en detalle',
  },
  'pricing.comparePlansHeading': {
    en: 'Compare plans in detail',
    es: 'Comparar planes en detalle',
  },
  'pricing.addonsHeading': {
    en: 'Enhance your plan',
    es: 'Mejora tu plan',
  },
  'pricing.addonAvailableFor': {
    en: 'Available for:',
    es: 'Disponible para:',
  },
  'pricing.compareFeatureColumn': {
    en: 'Feature',
    es: 'Función',
  },
  'pricing.compareTableAria': {
    en: 'Grumi plan comparison',
    es: 'Comparación de planes Grumi',
  },
  'pricing.cardPerMonth': {
    en: '/month',
    es: '/mes',
  },
  'pricing.save15': {
    en: 'Save 15%',
    es: 'Ahorra 15%',
  },
  'pricing.customPricing': {
    en: 'Custom pricing',
    es: 'Precio personalizado',
  },
  'pricing.tierListAria': {
    en: '{name} plan features',
    es: 'Funciones del plan {name}',
  },
  'pricing.footerDisclaimer': {
    en: 'All prices to be determined (TBD). Terms at launch.',
    es: 'Todos los precios por determinar. Condiciones al lanzamiento.',
  },
  'pricing.ctaWaitlist': {
    en: 'Request early access',
    es: 'Solicitar acceso anticipado',
  },
  'pricing.ctaWaitlistHint': {
    en: 'Grumi is in development — be among the first to try it.',
    es: 'Grumi está en desarrollo — sé de los primeros en probarlo.',
  },
  'pricing.ariaPricingPlans': {
    en: 'Pricing plans',
    es: 'Planes de precios',
  },
  'landing.navContactUs': {
    en: 'Contact Us',
    es: 'Contáctanos',
  },
  'marketing.bottomCta.title': {
    en: 'Ready to transform your salon?',
    es: '¿Listo para transformar tu salón?',
  },
  'marketing.bottomCta.subtitle': {
    en: 'Join the waitlist and get 25% off your first year.',
    es: 'Únete a la lista de espera y obtén 25% de descuento tu primer año.',
  },
  'marketing.features.heroTag': {
    en: 'SOLUTIONS',
    es: 'SOLUCIONES',
  },
  'marketing.features.heroTitle': {
    en: 'Everything your salon needs in one place',
    es: 'Todo lo que tu salón necesita, en un solo lugar',
  },
  'marketing.features.heroSubtitle': {
    en: 'Grumi was built specifically for pet grooming salons in Puerto Rico—from appointments to payroll, without the hassle.',
    es: 'Grumi fue diseñado específicamente para peluquerías de mascotas en Puerto Rico—desde citas hasta nómina, sin complicaciones.',
  },
  'marketing.features.highlight.spanish.body': {
    en: 'Work with labels, flows, and customer touchpoints that feel native for your Puerto Rico team from day one.',
    es: 'Trabaja con etiquetas, procesos y experiencias que se sienten naturales para tu equipo en Puerto Rico desde el primer día.',
  },
  'marketing.features.highlight.calendar.body': {
    en: 'Keep groomers fully booked with a visual calendar that makes it simple to balance blocks, durations, and staff availability.',
    es: 'Mantén a tu equipo siempre agendado con un calendario visual que facilita balancear bloques, duración y disponibilidad.',
  },
  'marketing.features.highlight.inventory.body': {
    en: 'Track products in real time from the front desk or on mobile, so you never run out during high-demand service windows.',
    es: 'Controla productos en tiempo real desde recepción o móvil, para no quedarte sin inventario en horas pico.',
  },
  'marketing.features.highlight.payroll.body': {
    en: 'Run payroll with rules aligned to Puerto Rico operations while keeping hours, commissions, and payouts organized.',
    es: 'Corre nómina con reglas alineadas a operaciones en Puerto Rico, manteniendo horas, comisiones y pagos organizados.',
  },
  'marketing.features.highlight.ath.body': {
    en: 'Connect ATH Móvil workflows alongside your other payment methods so Puerto Rico clients can pay the way they already prefer.',
    es: 'Integra ATH Móvil junto a tus otros métodos de pago para que tus clientes en Puerto Rico paguen como ya prefieren.',
  },
  'marketing.features.highlight.spanish.imageAlt': {
    en: 'Platform view focused on Spanish interface controls.',
    es: 'Vista de la plataforma enfocada en controles en español.',
  },
  'marketing.features.highlight.calendar.imageAlt': {
    en: 'Platform calendar view for grooming appointments.',
    es: 'Vista de calendario de citas de grooming en la plataforma.',
  },
  'marketing.features.highlight.inventory.imageAlt': {
    en: 'Platform inventory screen with mobile-friendly usage.',
    es: 'Pantalla de inventario con uso móvil en la plataforma.',
  },
  'marketing.features.highlight.payroll.imageAlt': {
    en: 'Platform payroll dashboard for Puerto Rico teams.',
    es: 'Panel de nómina de la plataforma para equipos de Puerto Rico.',
  },
  'marketing.features.highlight.ath.imageAlt': {
    en: 'Platform payment settings with ATH Móvil integration card.',
    es: 'Configuración de pagos en la plataforma con integración de ATH Móvil.',
  },
  'marketing.features.carouselEyebrow': {
    en: 'Additional features',
    es: 'Funciones adicionales',
  },
  'marketing.features.carouselPrev': {
    en: 'Scroll carousel left',
    es: 'Desplazar carrusel a la izquierda',
  },
  'marketing.features.carouselNext': {
    en: 'Scroll carousel right',
    es: 'Desplazar carrusel a la derecha',
  },
  'marketing.features.marquee.m1.title': {
    en: 'Transaction management',
    es: 'Manejo de Transacciones',
  },
  'marketing.features.marquee.m1.body': {
    en: 'Record sales, refunds, and payment flows in one ledger so your front desk and back office stay aligned.',
    es: 'Registra ventas, devoluciones y flujos de pago en un solo lugar para que recepción y oficina vayan alineadas.',
  },
  'marketing.features.marquee.m2.title': {
    en: 'Employee punch clock',
    es: 'Ponchador para Empleados',
  },
  'marketing.features.marquee.m2.body': {
    en: 'Simple PIN-based clock-in and clock-out so staff can punch from your devices without extra hardware.',
    es: 'Entrada y salida con PIN desde tus equipos, sin hardware extra para fichar el equipo.',
  },
  'marketing.features.marquee.m3.title': {
    en: 'Employee schedules',
    es: 'Horario de Empleados',
  },
  'marketing.features.marquee.m3.body': {
    en: 'Plan weekly shifts and availability so grooming blocks line up with who is actually on the floor.',
    es: 'Planifica turnos y disponibilidad semanal para que las citas coincidan con quien está en el salón.',
  },
  'marketing.features.marquee.m4.title': {
    en: 'Services by pet, breed, size, and coat',
    es: 'Servicios por Mascota, Raza, Tamaño y Pelo',
  },
  'marketing.features.marquee.m4.body': {
    en: 'Price and schedule services with rules that respect breed, size, coat length, and each pet’s profile.',
    es: 'Precifica y agenda servicios con reglas según raza, tamaño, tipo de pelo y el perfil de cada mascota.',
  },
  'marketing.features.marquee.m5.title': {
    en: 'Your business branding',
    es: 'Branding de tu Negocio',
  },
  'marketing.features.marquee.m5.body': {
    en: 'Carry your logo, colors, and voice through client touchpoints so every interaction feels like your salon.',
    es: 'Lleva tu logo, colores y tono a los puntos de contacto para que todo se sienta como tu marca.',
  },
  'marketing.features.marquee.m6.title': {
    en: 'Employee portal',
    es: 'Portal para Empleados',
  },
  'marketing.features.marquee.m6.body': {
    en: 'Give staff a focused space for schedules, tasks, and updates without exposing full admin controls.',
    es: 'Un espacio para el equipo con horarios, tareas y avisos sin exponer todo el panel administrativo.',
  },
  'marketing.features.marquee.m7.title': {
    en: 'Client portal',
    es: 'Portal para Clientes',
  },
  'marketing.features.marquee.m7.body': {
    en: 'Let pet parents self-serve bookings, forms, and messages in a branded experience they trust.',
    es: 'Que los dueños reserven, completen formularios y reciban mensajes en una experiencia con tu marca.',
  },
  'marketing.features.marquee.m8.title': {
    en: 'Integrated barcode scanner',
    es: 'Escáner de Barcode Integrado',
  },
  'marketing.features.marquee.m8.body': {
    en: 'Scan retail SKUs and product codes straight into checkout or inventory so lines move faster.',
    es: 'Escanea SKU y códigos al cobro o al inventario para agilizar la fila y el stock.',
  },
  'marketing.why.problemTitle': {
    en: 'Existing solutions were not built for Puerto Rico.',
    es: 'Las soluciones existentes no fueron hechas para Puerto Rico.',
  },
  'marketing.why.card1.title': { en: 'They do not speak your language', es: 'No hablan tu idioma' },
  'marketing.why.card1.body': {
    en: 'Platforms like DaySmart and Gingr are English-first with little support for the local market.',
    es: 'Plataformas como DaySmart y Gingr están en inglés y no ofrecen soporte para el mercado local.',
  },
  'marketing.why.card2.title': { en: 'Payments without ATH Móvil', es: 'Pagos sin ATH Móvil' },
  'marketing.why.card2.body': {
    en: 'Competitors do not integrate ATH Móvil—the preferred payment method in Puerto Rico.',
    es: 'Ningún competidor integra ATH Móvil — el método de pago preferido en Puerto Rico.',
  },
  'marketing.why.card3.title': { en: 'Unnecessary infrastructure', es: 'Infraestructura innecesaria' },
  'marketing.why.card3.body': {
    en: 'They expect physical POS readers and scanners that most salons in PR do not use or need.',
    es: 'Requieren lectores físicos de POS y escáneres que la mayoría de salones en PR no usan ni necesitan.',
  },
  'marketing.why.solutionTag': { en: 'BUILT FOR YOU', es: 'HECHO PARA TI' },
  'marketing.why.solutionTitle': {
    en: 'Grumi was born from the problem, not the lab.',
    es: 'Grumi nació del problema, no del laboratorio.',
  },
  'marketing.why.solutionBody': {
    en: 'We work directly with groomers and salon owners in Puerto Rico to understand real challenges—not a generic market. The result speaks your language, accepts the payments your clients use, and adapts to how you work.',
    es: 'Trabajamos directamente junto a peluqueros y dueños de salones en Puerto Rico para entender sus retos reales — no los de un mercado genérico. El resultado habla tu idioma, acepta los pagos que usan tus clientes, y se adapta a cómo tú trabajas.',
  },
  'marketing.why.pageTag': { en: 'The problem', es: 'El problema' },
  'marketing.why.diffHeading': {
    en: 'What you get with Grumi',
    es: 'Lo que obtienes con Grumi',
  },
  'marketing.why.diff1': {
    en: 'Fully Spanish interface',
    es: 'Interfaz completamente en español',
  },
  'marketing.why.diff2': {
    en: 'Native ATH Móvil and Stripe integration',
    es: 'Integración nativa con ATH Móvil y Stripe',
  },
  'marketing.why.diff3': {
    en: 'No hardware required—works on any device',
    es: 'Sin hardware requerido — funciona desde cualquier dispositivo',
  },
  'marketing.why.diff4': {
    en: 'Support and development from Puerto Rico',
    es: 'Soporte y desarrollo desde Puerto Rico',
  },
  'marketing.contact.title': {
    en: 'We are excited to have you at Grumi',
    es: 'Estamos emocionados de tenerte en Grumi',
  },
  'marketing.contact.subtitle': {
    en: 'If you have questions, feedback, or want to learn more about the platform, write to us directly.',
    es: 'Si tienes preguntas, comentarios o quieres saber más sobre la plataforma, escríbenos directamente.',
  },
  'marketing.contact.emailLabel': { en: 'Email', es: 'Correo' },
  'marketing.contact.copy': { en: 'Copy', es: 'Copiar' },
  'marketing.contact.copied': { en: 'Copied', es: 'Copiado' },
  'marketing.contact.waitlistHint': {
    en: 'Grumi is in active development. Be among the first to try it.',
    es: 'Grumi está en desarrollo activo. Sé de los primeros en probarlo.',
  },
  'marketing.contact.heroTag': { en: 'Contact', es: 'Contacto' },
  'marketing.contact.waitlistTitle': {
    en: 'Join the waitlist',
    es: 'Únete a la lista de espera',
  },
  'marketing.contact.waitlistLead': {
    en: 'Share your salon details and we will reach out when spots open.',
    es: 'Comparte los datos de tu salón y te contactaremos cuando abramos cupos.',
  },
  'footer.termsOfUse': { en: 'Terms of Use', es: 'Términos de Uso' },
  'footer.websiteTerms': { en: 'Website Terms of Use', es: 'Términos de Uso del Sitio' },
  'footer.privacyPolicy': { en: 'Privacy policy', es: 'Política de Privacidad' },
  'footer.cookieNotice': { en: 'Cookie notice', es: 'Aviso de cookies' },
  'footer.cookieSettings': { en: 'Cookie settings', es: 'Configuración de cookies' },
  'cookies.policyTitle': {
    en: 'Cookie policy',
    es: 'Política de cookies',
  },
  'cookies.policyBody': {
    en: 'I agree that this website uses cookies and similar technologies to provide the site and its features, to understand how it is used, and to show me relevant messages when permitted. You may change the settings to activate or deactivate each category of cookies. To find out more, please see our',
    es: 'Acepto que este sitio web use cookies y tecnologías similares para ofrecerme el sitio y sus funciones, para entender su uso y para mostrarme mensajes relevantes cuando lo permita. Puedes cambiar la configuración para activar o desactivar cada categoría de cookies. Para más información, consulta nuestro',
  },
  'cookies.policyBodyEnd': { en: '.', es: '.' },
  'cookies.cookieNoticeLink': { en: 'Cookie Notice', es: 'Aviso de cookies' },
  'cookies.acceptAllCaps': { en: 'Accept all', es: 'Aceptar todas' },
  'cookies.rejectAllCaps': { en: 'Reject all', es: 'Rechazar todas' },
  'cookies.settingsCaps': { en: 'Settings', es: 'Configuración' },
  'cookies.back': { en: 'Back', es: 'Volver' },
  'cookies.privacyLink': { en: 'Privacy policy', es: 'Política de privacidad' },
  'cookies.customize': { en: 'Customize', es: 'Personalizar' },
  'cookies.rejectOptional': {
    en: 'Reject non-essential',
    es: 'Rechazar no esenciales',
  },
  'cookies.acceptAll': { en: 'Accept all', es: 'Aceptar todas' },
  'cookies.dialogTitle': { en: 'Cookie preferences', es: 'Preferencias de cookies' },
  'cookies.dialogIntro': {
    en: 'Necessary cookies are always on. Turn optional categories on or off, then save.',
    es: 'Las cookies necesarias permanecen activas. Activa o desactiva las categorías opcionales y guarda.',
  },
  'cookies.dialogIntroCookieLead': {
    en: 'For more information, see our',
    es: 'Para más información, consulta nuestro',
  },
  'cookies.catNecessaryTitle': { en: 'Strictly necessary', es: 'Estrictamente necesarias' },
  'cookies.catNecessaryDesc': {
    en: 'Security, load balancing, session and authentication, and storing your consent decision.',
    es: 'Seguridad, balanceo de carga, sesión, autenticación y guardar tu decisión de consentimiento.',
  },
  'cookies.catPreferencesTitle': { en: 'Preferences', es: 'Preferencias' },
  'cookies.catPreferencesDesc': {
    en: 'Remember language, theme, and similar UI choices (including sidebar layout where applicable).',
    es: 'Recordar idioma, tema y opciones similares de la interfaz (incluido el menú lateral cuando aplique).',
  },
  'cookies.catAnalyticsTitle': { en: 'Analytics', es: 'Analíticas' },
  'cookies.catAnalyticsDesc': {
    en: 'Help us understand traffic and product usage (for example Google Analytics when enabled by us).',
    es: 'Nos ayudan a entender tráfico y uso del producto (por ejemplo Google Analytics si lo habilitamos).',
  },
  'cookies.catMarketingTitle': { en: 'Marketing', es: 'Marketing' },
  'cookies.catMarketingDesc': {
    en: 'Measure campaigns or show relevant offers if we add marketing tools later.',
    es: 'Medir campañas u ofertas relevantes si añadimos herramientas de marketing más adelante.',
  },
  'cookies.cancel': { en: 'Close', es: 'Cerrar' },
  'cookies.saveChoices': { en: 'Save choices', es: 'Guardar elección' },
  'landing.modalClose': {
    en: 'Close modal',
    es: 'Cerrar'
  },
  'landing.modalWelcomeBack': {
    en: 'Welcome Back',
    es: 'Bienvenido de Nuevo'
  },
  'landing.modalSignUp': {
    en: 'Sign Up',
    es: 'Regístrate'
  },

  // Waitlist (pre-launch)
  'waitlist.navCta': {
    en: 'Join the Waitlist',
    es: 'Únete a la Lista'
  },
  'waitlist.splashCta': {
    en: 'Join the Grumi Waitlist',
    es: 'Únete a la Lista de Espera de Grumi'
  },
  'waitlist.welcomeJoined': {
    en: 'You are on the list. Check your inbox for a welcome note.',
    es: 'Ya estás en la lista. Revisa tu correo de bienvenida.'
  },
  'waitlist.modalTitleJoin': {
    en: 'Join the waitlist',
    es: 'Únete a la lista de espera'
  },
  'waitlist.modalTitleSurvey': {
    en: 'Quick survey (optional)',
    es: 'Encuesta breve (opcional)'
  },
  'waitlist.modalTitleReferral': {
    en: 'You are in — share your link',
    es: 'Ya estás dentro — comparte tu enlace'
  },
  'waitlist.referralStepLead': {
    en: 'Copy your referral link if you like, then continue to a few optional questions.',
    es: 'Copia tu enlace de referido si quieres, luego continúa con unas preguntas opcionales.'
  },
  'waitlist.continueToSurvey': {
    en: 'Continue to survey',
    es: 'Continuar a la encuesta'
  },
  'waitlist.modalFormLead': {
    en: 'We will email you a welcome note. All fields are required.',
    es: 'Te enviaremos un correo de bienvenida. Todos los campos son obligatorios.'
  },
  'waitlist.referralYourLink': {
    en: 'Your referral link',
    es: 'Tu enlace de referido'
  },
  'waitlist.referralCopy': {
    en: 'Copy link',
    es: 'Copiar enlace'
  },
  'waitlist.referralCopied': {
    en: 'Link copied',
    es: 'Enlace copiado'
  },
  'waitlist.referralBadge': {
    en: 'Share Grumi',
    es: 'Comparte Grumi'
  },
  'waitlist.referralExplain1': {
    en: "This link includes your referral code so friends can join through you. The referral 10% off stacks with Founder's Price (25% off the first year) for one month once billing is live, subject to the terms in effect.",
    es: 'Este enlace incluye tu código de referido para que otros se registren contigo. El 10% por referido se acumula con el Precio Fundador (25% off el primer año) durante un mes cuando activemos pagos, según los términos vigentes.'
  },
  'waitlist.referralExplain2': {
    en: 'You may earn rewards when people you refer subscribe; details will follow when billing opens. Copy your link now—you will also find it in your welcome email.',
    es: 'Podrías obtener beneficios cuando se suscriban personas que refieres; los detalles llegarán al abrir pagos. Copia tu enlace ahora; también lo verás en tu correo de bienvenida.'
  },
  'waitlist.referralCodeLabel': {
    en: 'Referral code (optional)',
    es: 'Código de referido (opcional)'
  },
  'waitlist.referralCodePlaceholder': {
    en: 'Referral code if you have one',
    es: 'Código de referido si tienes uno'
  },
  'waitlist.referralCodeHint': {
    en: "A valid code from another groomer stacks an extra 10% with Founder's Price (25% off your first year) for one month once billing is live, subject to the terms in effect.",
    es: 'Un código válido de otro groomer suma un 10% extra al Precio Fundador (25% off tu primer año) durante un mes cuando activemos pagos, según los términos vigentes.'
  },
  'waitlist.continueHome': {
    en: 'Back to home',
    es: 'Volver al inicio'
  },
  'waitlist.emailPlaceholder': {
    en: 'your@email.com',
    es: 'tu@email.com'
  },
  'waitlist.fullNamePlaceholder': {
    en: 'Your full name',
    es: 'Tu nombre completo',
  },
  'waitlist.businessNamePlaceholder': {
    en: 'Business / salon name',
    es: 'Nombre del negocio o salón',
  },
  'waitlist.errorRequiredProfile': {
    en: 'Please enter your name, business name, and a valid email.',
    es: 'Ingresa tu nombre, el nombre del negocio y un correo válido.',
  },
  'waitlist.submitCta': {
    en: 'Secure my spot',
    es: 'Asegurar mi lugar'
  },
  'waitlist.founderLine': {
    en: "Founder's Price: 25% off your first year at launch",
    es: 'Precio Fundador: 25% off tu primer año al lanzar'
  },
  'waitlist.alreadyRegistered': {
    en: "You're already on the list. We'll notify you soon!",
    es: 'Ya estás en la lista. ¡Te notificaremos pronto!'
  },
  'waitlist.errorInvalidEmail': {
    en: 'Please enter a valid email',
    es: 'Por favor ingresa un email válido'
  },
  'waitlist.errorGeneric': {
    en: 'Something went wrong. Please try again.',
    es: 'Algo salió mal. Intenta de nuevo.'
  },
  'waitlist.confirmedTitle': {
    en: "You're in!",
    es: '¡Estás dentro!'
  },
  'waitlist.confirmedSubtitle': {
    en: "Your Founder's Price is locked in.",
    es: 'Tu Precio Fundador está asegurado.'
  },
  'waitlist.confirmedNext': {
    en: "We'll notify you when Grumi is ready.",
    es: 'Te notificaremos cuando Grumi esté listo.'
  },
  'waitlist.surveyIntro': {
    en: 'Can you help us with 4 quick questions?',
    es: '¿Nos ayudas con 4 preguntas rápidas?'
  },
  'waitlist.surveySubmit': {
    en: 'Submit answers',
    es: 'Enviar respuestas'
  },
  'waitlist.surveyErrorAnswerQuestion': {
    en: 'Please answer question #{n}.',
    es: 'Por favor responde la pregunta #{n}.'
  },
  'waitlist.surveyErrorOtherLength': {
    en: 'The “other” note is too long (max 180 characters).',
    es: 'La nota de “otro” es demasiado larga (máx. 180 caracteres).'
  },
  'waitlist.surveyThanks': {
    en: 'Thanks for your answers!',
    es: '¡Gracias por tus respuestas!'
  },
  'waitlist.surveySubmitError': {
    en: 'We could not save your answers. Please try again.',
    es: 'No pudimos guardar tus respuestas. Intenta de nuevo.'
  },
  'waitlist.surveyStep1': { en: 'Step 1', es: 'Paso 1' },
  'waitlist.surveyStep2': { en: 'Step 2', es: 'Paso 2' },
  'waitlist.surveyStep3': { en: 'Step 3', es: 'Paso 3' },
  'waitlist.surveyStep4': { en: 'Step 4', es: 'Paso 4' },
  'waitlist.surveyQ1': {
    en: 'How many groomers work at your business?',
    es: '¿Cuántos groomers trabajan en tu negocio?'
  },
  'waitlist.surveyQ1solo': { en: 'Just Me', es: 'Solo yo' },
  'waitlist.surveyQ1_2_5': { en: '2–5', es: '2–5' },
  'waitlist.surveyQ1_6_9': { en: '6–9', es: '6–9' },
  'waitlist.surveyQ1_10plus': { en: '10+', es: '10+' },
  'waitlist.surveyQ2': {
    en: 'What tools do you use to run your business?',
    es: '¿Qué herramientas usas para manejar tu negocio?'
  },
  'waitlist.surveyQ2Hint': {
    en: 'Select all that apply.',
    es: 'Selecciona todas las que apliquen.'
  },
  'waitlist.toolPenPaper': { en: 'Paper or notebook', es: 'Papel o libreta' },
  'waitlist.toolSheet': { en: 'Excel / Google Sheets', es: 'Excel / Google Sheets' },
  'waitlist.toolSoftware': {
    en: 'Software (DaySmart Pet, Gingr, …)',
    es: 'Software (DaySmart Pet, Gingr, …)'
  },
  'waitlist.toolOther': { en: 'Other', es: 'Otro' },
  'waitlist.toolOtherDetail': {
    en: 'If other, tell us briefly (optional)',
    es: 'Si es otro, cuéntanos brevemente (opcional)'
  },
  'waitlist.toolOtherPlaceholder': {
    en: 'Which tool?',
    es: '¿Cuál herramienta?'
  },
  'waitlist.surveyQ3': {
    en: "What's your biggest operational headache?",
    es: '¿Cuál es tu mayor dolor de cabeza operacional?'
  },
  'waitlist.surveyQ4': {
    en: 'Which of these matter to you?',
    es: '¿Cuáles de estas te importan?'
  },
  'waitlist.surveyQ4Hint': {
    en: 'Select all that apply.',
    es: 'Selecciona todas las que apliquen.'
  },
  'waitlist.featureFAthMovil': {
    en: 'ATH Móvil integration',
    es: 'Integración ATH Móvil'
  },
  'waitlist.featureFCosto': {
    en: 'Cost / pricing',
    es: 'Costo'
  },
  'waitlist.featureFNomina': {
    en: 'Puerto Rico payroll',
    es: 'Nómina de PR'
  },
  'waitlist.featureFStaff': {
    en: 'Employee management',
    es: 'Manejo de empleados'
  },
  'waitlist.featureFSpanish': {
    en: 'Spanish interface',
    es: 'Interfaz en español'
  },
  'waitlist.featureFCitas': {
    en: 'Online appointments',
    es: 'Citas en línea'
  },
  'waitlist.featureFCobrar': {
    en: 'Charge online',
    es: 'Cobrar online'
  },
  'waitlist.featureFInventory': {
    en: 'Inventory',
    es: 'Inventario'
  },
  'waitlist.featureFReports': {
    en: 'Advanced reports',
    es: 'Reportes avanzados'
  },
  'waitlist.invalidLink': {
    en: 'This confirmation link is invalid or expired.',
    es: 'Este enlace de confirmación no es válido o expiró.'
  },
  'waitlist.confirmedNoSurveyToken': {
    en: 'Thanks for confirming. We will email you when Grumi launches.',
    es: 'Gracias por confirmar. Te escribiremos cuando Grumi lance.'
  },
  'waitlist.backHome': {
    en: 'Back to home',
    es: 'Volver al inicio'
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
  'login.subtitleBusiness': {
    en: 'Sign in to access {businessName}',
    es: 'Inicia sesión para acceder a {businessName}'
  },
  'login.notLinkedMessage': {
    en: "We detected you have a Grumi account, but you're not linked to {businessName} yet. Would you like to link your account now?",
    es: 'Ya tienes una cuenta de Grumi, pero no estás vinculado a {businessName}. ¿Quieres vincular tu cuenta ahora?'
  },
  'login.linkMyAccount': {
    en: 'Link My Account',
    es: 'Vincular mi cuenta'
  },
  'login.revokedMessage': {
    en: 'Your access to {businessName} has been revoked. Please contact them for more information.',
    es: 'Tu acceso a {businessName} ha sido revocado. Contáctalos para más información.'
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
  'login.forgotPassword': {
    en: 'Forgot password?',
    es: '¿Olvidaste tu contraseña?'
  },
  'login.resetPasswordTitle': {
    en: 'Reset password',
    es: 'Restablecer contraseña'
  },
  'login.resetPasswordHint': {
    en: 'Enter your email. We’ll send a link to reset your password. Limit: 3 requests per hour per email.',
    es: 'Ingresa tu correo. Enviaremos un enlace para restablecer tu contraseña. Límite: 3 solicitudes por hora por correo.'
  },
  'login.resetPasswordSuccess': {
    en: 'If an account exists for this email, you’ll receive a password reset link.',
    es: 'Si existe una cuenta con este correo, recibirás un enlace para restablecer tu contraseña.'
  },
  'login.resetPasswordTooMany': {
    en: 'Too many reset requests for this email. Please try again in 1 hour.',
    es: 'Demasiadas solicitudes para este correo. Intenta de nuevo en 1 hora.'
  },
  'login.errorGeneric': {
    en: 'Something went wrong. Please try again.',
    es: 'Algo salió mal. Por favor intenta de nuevo.'
  },
  'login.rateLimitSite': {
    en: 'Too many requests from your network. Please wait 1 hour, then try again.',
    es: 'Demasiadas solicitudes desde tu red. Espera 1 hora e intenta de nuevo.'
  },

  // Register page
  'register.title': {
    en: 'Create your account',
    es: 'Crea tu cuenta'
  },
  'register.subtitle': {
    en: 'Join Grumi',
    es: 'Únete a Grumi'
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
  'register.planBasic': {
    en: 'Basic',
    es: 'Básico'
  },
  'register.planGrowth': {
    en: 'Growth',
    es: 'Growth'
  },
  'register.planPro': {
    en: 'Pro',
    es: 'Pro'
  },
  'register.planBasicDesc': {
    en: 'For small grooming businesses',
    es: 'Para negocios de grooming pequeños'
  },
  'register.planGrowthDesc': {
    en: 'Ideal for growing businesses',
    es: 'Ideal para negocios en crecimiento'
  },
  'register.planProDesc': {
    en: 'For large operations',
    es: 'Para operaciones grandes'
  },
  'register.planEnterprise': {
    en: 'Enterprise',
    es: 'Empresarial'
  },
  'register.planEnterpriseDesc': {
    en: 'Custom solutions for VIP clients (contact us)',
    es: 'Soluciones a medida para clientes VIP (contáctanos)'
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
  'register.errorEmailInUseOwner': {
    en: 'This email is already registered. Log in here.',
    es: 'Este correo ya está registrado. Inicia sesión aquí.'
  },
  'register.errorEmailInUseClient': {
    en: "This email is already registered. If you're a client of a business, log in through the client portal.",
    es: 'Este correo ya está registrado. Si eres cliente de un negocio, inicia sesión en el portal de clientes.'
  },
  'register.linkAccountTitle': {
    en: 'Welcome back!',
    es: '¡Bienvenido de nuevo!'
  },
  'register.linkAccountDescription': {
    en: "We detected you already have a Grumi account with this email. To access {businessName}'s services, enter your existing password to link this business to your account.",
    es: 'Ya tienes una cuenta de Grumi con este correo. Para acceder a los servicios de {businessName}, ingresa tu contraseña para vincular este negocio.'
  },
  'register.linkAccountButton': {
    en: 'Link Account & Continue',
    es: 'Vincular cuenta y continuar'
  },
  'register.linkAccountPrivacy': {
    en: 'This will allow {businessName} to schedule appointments with you, view your contact information, and see pets you add. Your data from other businesses remains private.',
    es: '{businessName} podrá agendar citas contigo, ver tu información de contacto y las mascotas que agregues. Tus datos de otros negocios siguen siendo privados.'
  },
  'register.linkIncorrectPassword': {
    en: 'Incorrect password. Please try again or reset your password.',
    es: 'Contraseña incorrecta. Intenta de nuevo o restablece tu contraseña.'
  },
  'register.linkVerifyEmailFirst': {
    en: 'Please verify your email first. Check your inbox and spam folder.',
    es: 'Verifica tu correo primero. Revisa tu bandeja y spam.'
  },
  'register.linkSuccess': {
    en: 'Account linked successfully!',
    es: '¡Cuenta vinculada correctamente!'
  },
  'register.linkedAndWelcome': {
    en: 'Account created and linked. Welcome!',
    es: 'Cuenta creada y vinculada. ¡Bienvenido!'
  },
  'register.linkAccountPrompt': {
    en: 'This email is already registered. Enter your password below to link this business to your account.',
    es: 'Este correo ya está registrado. Ingresa tu contraseña para vincular este negocio.'
  },
  'register.clientPortalLogin': {
    en: 'Client portal login',
    es: 'Iniciar sesión en el portal de clientes'
  },

  // Logout dialog
  'logout.title': {
    en: 'Log out',
    es: 'Cerrar sesión'
  },
  'logout.confirm': {
    en: 'Are you sure you want to log out of Grumi?',
    es: '¿Seguro que quieres cerrar sesión en Grumi?'
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

  'portal.section.myInformation': {
    en: 'My information',
    es: 'Mi información'
  },
  'portal.section.myPets': {
    en: 'My pets',
    es: 'Mis mascotas'
  },
  'portal.section.appointments': {
    en: 'My appointments',
    es: 'Mis citas'
  },
  'portal.section.directory': {
    en: 'Business directory',
    es: 'Directorio de negocios'
  },
  'portal.section.payments': {
    en: 'Payment methods',
    es: 'Métodos de pago'
  },
  'portal.section.locator': {
    en: 'Store locator',
    es: 'Ubicación'
  },
  'portal.section.purchases': {
    en: 'Purchase history',
    es: 'Historial de compras'
  },
  'portal.paymentsComingSoon': {
    en: 'Saved cards will be available soon.',
    es: 'Las tarjetas guardadas estarán disponibles pronto.'
  },
  'portal.completeProfileFirst': {
    en: 'Save your contact information below before adding pets.',
    es: 'Guarda tu información de contacto antes de agregar mascotas.'
  },
  'portal.directoryCta': {
    en: 'Browse all businesses and open their client portal.',
    es: 'Explora negocios y abre su portal de clientes.'
  },
  'portal.goToDirectory': {
    en: 'Open directory',
    es: 'Ir al directorio'
  },
  'portal.petsNeedBusinessContext': {
    en: 'To add pets, open the portal from a business link (directory or QR) or connect your account to a business. Your profile does not require a business until you choose one.',
    es: 'Para agregar mascotas, abre el portal desde el enlace de un negocio (directorio o QR) o vincula tu cuenta a un negocio. Tu perfil no requiere un negocio hasta que elijas uno.'
  },
  'portal.multiBusinessExplainer': {
    en: 'You have one client profile for all businesses. Pick a business above to filter appointments, map, and purchases; pets are stored under the business you select when you add them.',
    es: 'Tienes un solo perfil de cliente para todos los negocios. Elige un negocio arriba para filtrar citas, mapa y compras; las mascotas se guardan bajo el negocio que tengas seleccionado al agregarlas.'
  },
  'portal.selectBusinessBeforePet': {
    en: 'Choose a business in the selector above (or open the portal from a business link).',
    es: 'Elige un negocio en el selector de arriba (o abre el portal desde el enlace de un negocio).'
  },
  'portal.petBusinessLabel': {
    en: 'Register pets under this business',
    es: 'Registrar mascotas en este negocio'
  },
  'portal.petNoAppointmentNeeded': {
    en: 'No appointment is required—you can add pets as soon as your profile is saved and a business is selected.',
    es: 'No necesitas cita previa: puedes agregar mascotas en cuanto guardes tu perfil y elijas un negocio.'
  },
  'portal.removePetTitle': {
    en: 'Remove this pet?',
    es: '¿Quitar esta mascota?'
  },
  'portal.removePetConfirm': {
    en: 'Remove {name} from your profile? Related appointment rows tied to this pet may also be deleted.',
    es: '¿Quitar a {name} de tu perfil? Las citas vinculadas a esta mascota también pueden eliminarse.'
  },
  'portal.removePetSuccess': {
    en: 'Pet removed from your profile.',
    es: 'Mascota quitada de tu perfil.'
  },
  'portal.removePetError': {
    en: 'Could not remove this pet. Try again or contact support.',
    es: 'No se pudo quitar la mascota. Intenta de nuevo o contacta soporte.'
  },
  'portal.removePetAria': {
    en: 'Remove pet',
    es: 'Quitar mascota'
  },
  'portal.removePetButton': {
    en: 'Remove pet from profile',
    es: 'Quitar mascota del perfil'
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
  'nav.transactions': {
    en: 'Transactions',
    es: 'Transacciones'
  },
  'nav.timeTracking': {
    en: 'Time Tracking',
    es: 'Registro de Tiempo'
  },
  'nav.employees': {
    en: 'Staff',
    es: 'Personal'
  },
  'nav.myStaffProfile': {
    en: 'My Profile',
    es: 'Mi perfil'
  },
  'nav.timesheets': {
    en: 'Timesheets',
    es: 'Hojas de horas'
  },
  'employeeManagement.selfServiceSubtitle': {
    en: 'Your staff record in this business (read-only).',
    es: 'Tu registro en el negocio (solo lectura).'
  },
  'employeeManagement.selfServiceProfileMissing': {
    en: 'We could not load your staff profile. Ask a manager to confirm your account is linked to a staff record.',
    es: 'No se pudo cargar tu ficha de personal. Pide a un gerente que confirme que tu cuenta está vinculada al personal.'
  },
  'nav.employeeInfo': {
    en: 'Staff directory',
    es: 'Directorio del personal'
  },
  'nav.schedule': {
    en: 'Schedule',
    es: 'Horario'
  },
  'nav.mySchedule': {
    en: 'My Schedule',
    es: 'Mi Horario'
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
    en: 'Timesheets',
    es: 'Hojas de horas'
  },
  'timesheet.grossPayTaxNote': {
    en: 'Gross pay does not include tax deductions or other withholdings.',
    es: 'El pago bruto no incluye retenciones de impuestos ni otras deducciones.'
  },
  'timesheet.downloadPdf': {
    en: 'Download PDF report',
    es: 'Descargar informe PDF'
  },
  'timesheet.downloadReport': {
    en: 'Download report',
    es: 'Descargar informe'
  },
  'timesheet.downloadFormatPdf': {
    en: 'PDF',
    es: 'PDF'
  },
  'timesheet.downloadFormatCsv': {
    en: 'CSV (summary & details)',
    es: 'CSV (resumen y detalles)'
  },
  'timesheet.downloadFormatXlsx': {
    en: 'Excel (.xlsx)',
    es: 'Excel (.xlsx)'
  },
  'timesheet.exportSectionPayPeriodSummary': {
    en: 'Pay period summary',
    es: 'Resumen del período de pago'
  },
  'timesheet.exportSectionTimesheetDetails': {
    en: 'Timesheet details',
    es: 'Detalle de hoja de horas'
  },
  'timesheet.exportSheetSummary': {
    en: 'Summary',
    es: 'Resumen'
  },
  'timesheet.exportSheetDetails': {
    en: 'Timesheet details',
    es: 'Detalle'
  },
  'timesheet.exportField': {
    en: 'Field',
    es: 'Campo'
  },
  'timesheet.exportValue': {
    en: 'Value',
    es: 'Valor'
  },
  'timesheet.backToProfile': {
    en: 'Back to My Profile',
    es: 'Volver a Mi perfil'
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
  'nav.apptBook': {
    en: 'Appt Book',
    es: 'Reservar cita'
  },
  'apptBook.appointmentList': {
    en: 'Appointment List',
    es: 'Lista de citas'
  },
  'apptBook.onlineRequests': {
    en: 'Online Requests',
    es: 'Solicitudes en línea'
  },
  'apptBook.settings': {
    en: 'Settings',
    es: 'Configuración'
  },
  'apptBook.listSearchPlaceholder': {
    en: 'Search for client or pet',
    es: 'Buscar cliente o mascota'
  },
  'apptBook.allEmployees': {
    en: 'All staff',
    es: 'Todo el personal'
  },
  'apptBook.allRooms': {
    en: 'All rooms',
    es: 'Todas las salas'
  },
  'apptBook.allStatuses': {
    en: 'All appointments',
    es: 'Todas las citas'
  },
  'apptBook.dateScopeDay': {
    en: 'This day',
    es: 'Este día'
  },
  'apptBook.dateScopeAll': {
    en: 'All dates',
    es: 'Todas las fechas'
  },
  'apptBook.paymentPaid': {
    en: 'Paid',
    es: 'Pagado'
  },
  'apptBook.paymentUnpaid': {
    en: 'Unpaid',
    es: 'Sin pagar'
  },
  'apptBook.paymentDash': {
    en: '—',
    es: '—'
  },
  'apptBook.noMatchingRows': {
    en: 'No appointments match your filters.',
    es: 'Ninguna cita coincide con los filtros.'
  },
  'apptBook.columnId': {
    en: 'ID',
    es: 'ID'
  },
  'apptBook.columnStatus': {
    en: 'Status',
    es: 'Estado'
  },
  'apptBook.columnPet': {
    en: 'Pet',
    es: 'Mascota'
  },
  'apptBook.columnClient': {
    en: 'Client',
    es: 'Cliente'
  },
  'apptBook.columnDate': {
    en: 'Date',
    es: 'Fecha'
  },
  'apptBook.columnTime': {
    en: 'Time',
    es: 'Hora'
  },
  'apptBook.columnServices': {
    en: 'Services',
    es: 'Servicios'
  },
  'apptBook.columnEmployee': {
    en: 'Employee',
    es: 'Empleado'
  },
  'apptBook.columnPayment': {
    en: 'Payment',
    es: 'Pago'
  },
  'apptBook.columnTotal': {
    en: 'Total',
    es: 'Total'
  },
  'apptBook.columnActions': {
    en: 'Actions',
    es: 'Acciones'
  },
  'apptBook.unassigned': {
    en: 'Unassigned',
    es: 'Sin asignar'
  },
  'apptBook.byDay': {
    en: 'By Day',
    es: 'Por día'
  },
  'apptBook.byWeek': {
    en: 'By Week',
    es: 'Por semana'
  },
  'apptBook.filterCalendar': {
    en: 'Filter calendar',
    es: 'Filtrar calendario'
  },
  'apptBook.specialist': {
    en: 'Specialist',
    es: 'Especialista'
  },
  'apptBook.bookingCategory': {
    en: 'Booking category',
    es: 'Categoría de reserva'
  },
  'apptBook.searchCategories': {
    en: 'Search categories',
    es: 'Buscar categorías'
  },
  'apptBook.allCategories': {
    en: 'All categories',
    es: 'Todas las categorías'
  },
  'apptBook.allStaff': {
    en: 'All staff',
    es: 'Todo el personal'
  },
  'apptBook.clearFilters': {
    en: 'Clear filters',
    es: 'Borrar filtros'
  },
  'apptBook.noBusinessHoursThisDay': {
    en: 'No business hours on this day.',
    es: 'No hay horario comercial este día.'
  },
  'apptBook.openAppointmentFailed': {
    en: 'Could not open this appointment.',
    es: 'No se pudo abrir esta cita.'
  },
  'nav.support': {
    en: 'Support',
    es: 'Soporte'
  },
  'nav.settings': {
    en: 'Settings',
    es: 'Configuración'
  },
  'nav.darkMode': {
    en: 'Dark Mode',
    es: 'Modo oscuro'
  },
  'nav.notifications': {
    en: 'Notifications',
    es: 'Notificaciones'
  },
  'nav.markAllRead': {
    en: 'Mark all read',
    es: 'Marcar todo leído'
  },
  'nav.dismissAll': {
    en: 'Dismiss all',
    es: 'Descartar todo'
  },
  'nav.noNotifications': {
    en: 'No notifications',
    es: 'Sin notificaciones'
  },
  'notifications.pageTitle': {
    en: 'Notifications',
    es: 'Notificaciones'
  },
  'notifications.subtitle': {
    en: 'Last 60 days',
    es: 'Últimos 60 días'
  },
  'notifications.empty60Days': {
    en: 'No notifications in the last 60 days',
    es: 'No hay notificaciones en los últimos 60 días'
  },
  'notifications.yesterday': {
    en: 'Yesterday',
    es: 'Ayer'
  },
  'notifications.unread': {
    en: 'Unread',
    es: 'No leída'
  },
  'notifications.all': {
    en: 'All',
    es: 'Todas'
  },
  'notifications.seeHistory': {
    en: 'See notification history',
    es: 'Ver historial de notificaciones'
  },
  'notifications.type.appointment': {
    en: 'Appointment',
    es: 'Cita'
  },
  'notifications.type.pet': {
    en: 'Pet',
    es: 'Mascota'
  },
  'notifications.type.inventory': {
    en: 'Inventory',
    es: 'Inventario'
  },
  'notifications.type.payment': {
    en: 'Payment',
    es: 'Pago'
  },
  'notifications.type.service': {
    en: 'Service',
    es: 'Servicio'
  },
  'notifications.type.birthday': {
    en: 'Birthday',
    es: 'Cumpleanos'
  },
  'notifications.type.birthdayTeam': {
    en: 'Team birthday',
    es: 'Cumpleaños del equipo'
  },
  'notifications.type.birthdayCelebration': {
    en: 'Your birthday',
    es: 'Tu cumpleaños'
  },
  'notifications.employeeBirthdayTeam': {
    en: "🎉 Today is {name}'s birthday!",
    es: '🎉 ¡Hoy es el cumpleaños de {name}!'
  },
  'notifications.employeeBirthdayCelebrationPreview': {
    en: '🎂 Happy Birthday, {name}! Tap to celebrate',
    es: '🎂 ¡Feliz cumpleaños, {name}! Toca para celebrar'
  },
  'notifications.type.general': {
    en: 'General',
    es: 'General'
  },
  'notifications.settingsTitle': {
    en: 'Notification Settings',
    es: 'Configuracion de notificaciones'
  },
  'notifications.settingsDescription': {
    en: 'Choose which notifications you want to receive.',
    es: 'Elige que notificaciones deseas recibir.'
  },
  'notifications.settingsSaved': {
    en: 'Notification settings saved',
    es: 'Configuracion de notificaciones guardada'
  },
  'notifications.pref.unbilledAppointments': {
    en: 'Completed appointments without billing',
    es: 'Citas completadas sin facturacion'
  },
  'notifications.pref.unbilledAppointmentsDesc': {
    en: 'Get alerted when a completed appointment has no transaction yet.',
    es: 'Recibe alerta cuando una cita completada aun no tiene transaccion.'
  },
  'notifications.pref.lowStock': {
    en: 'Low stock alerts',
    es: 'Alertas de inventario bajo'
  },
  'notifications.pref.lowStockDesc': {
    en: 'Notify when inventory reaches reorder levels.',
    es: 'Notifica cuando el inventario llega al nivel de reorden.'
  },
  'notifications.pref.paymentOverdue': {
    en: 'Overdue payment reminders',
    es: 'Recordatorios de pagos vencidos'
  },
  'notifications.pref.paymentOverdueDesc': {
    en: 'Notify when transactions remain partially unpaid.',
    es: 'Notifica cuando una transaccion sigue parcialmente sin pagar.'
  },
  'notifications.pref.birthdays': {
    en: 'Birthday reminders',
    es: 'Recordatorios de cumpleanos'
  },
  'notifications.pref.birthdaysDesc': {
    en: 'Monthly reminders for birthdays in your team.',
    es: 'Recordatorios mensuales de cumpleaños en los registros de tu equipo.'
  },
  'notifications.pref.general': {
    en: 'General notices',
    es: 'Avisos generales'
  },
  'notifications.pref.generalDesc': {
    en: 'Enable general operational reminders and updates.',
    es: 'Activa recordatorios y actualizaciones generales.'
  },
  'nav.user': {
    en: 'User',
    es: 'Usuario'
  },
  'nav.adminHome': {
    en: 'Admin home',
    es: 'Inicio de administración',
  },
  'nav.backToApp': {
    en: 'Back to app',
    es: 'Volver a la app',
  },
  'nav.accountSettings': {
    en: 'Account Settings',
    es: 'Configuración de cuenta'
  },
  'nav.businessSettings': {
    en: 'Business Settings',
    es: 'Configuración del negocio'
  },
  'nav.bookingSettings': {
    en: 'Booking Settings',
    es: 'Configuración de reservas'
  },
  'nav.billing': {
    en: 'Billing',
    es: 'Facturación'
  },
  'nav.subscription': {
    en: 'Subscription',
    es: 'Suscripción'
  },
  'nav.help': {
    en: 'Help',
    es: 'Ayuda'
  },
  'nav.needHelp': {
    en: 'Need Help?',
    es: '¿Necesitas ayuda?'
  },
  'nav.logOut': {
    en: 'Log Out',
    es: 'Cerrar sesión'
  },
  'employeePortal.subtitle': {
    en: 'Staff portal',
    es: 'Portal de empleados'
  },
  'layout.demoLocalSettingsHint': {
    en: 'DEMO: changes are not saved',
    es: 'Modo DEMO: cambios no se guardan',
  },
  'demo.workspaceReadOnlyAction': {
    en: 'This demo workspace is view-only. Sign up for a real account to add or change data.',
    es: 'Este espacio demo es solo lectura. Crea una cuenta real para agregar o cambiar datos.',
  },
  'layout.betaTooltip': {
    en: "We're still refining Grumi. Your feedback is welcome!",
    es: 'Seguimos puliendo Grumi. ¡Tu opinión es bienvenida!',
  },
  'layout.guestShort': {
    en: 'Guest',
    es: 'Invitado',
  },
  'layout.demoProfileMenuLabel': {
    en: 'Demo · Manager preview',
    es: 'Demo · Vista de gerente',
  },
  'layout.demoUserName': {
    en: 'Demo User',
    es: 'Usuario demo',
  },
  'layout.demoSignedInWorkspaceHint': {
    en: 'This is a shared demo workspace with sample data so you can explore safely. Inventory and transactions are view-only (nothing is saved). Log out when you are done to return to the main site.',
    es: 'Este es un espacio demo compartido con datos de ejemplo para que explores con seguridad. Inventario y transacciones son solo lectura (no se guarda nada). Cierra sesión cuando termines para volver al sitio principal.',
  },
  'layout.featurePreviewChannel': {
    en: 'Feature preview (super admin)',
    es: 'Vista previa de funciones (super admin)',
  },
  'layout.tierProduction': {
    en: 'Production',
    es: 'Producción',
  },
  'layout.tierStaged': {
    en: 'Staged',
    es: 'Staged',
  },
  'layout.tierDevelopment': {
    en: 'Development',
    es: 'Desarrollo',
  },
  'auth.inPlaceLoginTitle': {
    en: 'Your session ended',
    es: 'Tu sesión finalizó',
  },
  'auth.inPlaceLoginDescription': {
    en: 'Sign in again to continue on this page.',
    es: 'Inicia sesión de nuevo para continuar en esta página.',
  },
  'layout.supportSignInAsUser': {
    en: 'Support: sign in as user…',
    es: 'Soporte: iniciar sesión como usuario…',
  },
  'layout.supportDialogTitle': {
    en: 'Support sign-in',
    es: 'Inicio de sesión de soporte',
  },
  'layout.supportDialogDescription': {
    en: 'You will receive a full session as the selected account (same data access as that user). Choose a business first, then a person with a linked login.',
    es: 'Obtendrás una sesión completa de la cuenta seleccionada (mismo acceso a datos que ese usuario). Elige un negocio y luego una persona con inicio de sesión vinculado.',
  },
  'layout.supportBusiness': {
    en: 'Business',
    es: 'Negocio',
  },
  'layout.supportPickBusiness': {
    en: 'Search business…',
    es: 'Buscar negocio…',
  },
  'layout.supportTestAsMode': {
    en: 'Test as',
    es: 'Probar como',
  },
  'layout.supportModeRole': {
    en: 'Role',
    es: 'Rol',
  },
  'layout.supportModeUser': {
    en: 'User',
    es: 'Usuario',
  },
  'layout.supportAccessRole': {
    en: 'Access role',
    es: 'Rol de acceso',
  },
  'layout.supportAccessRoleAny': {
    en: 'Any',
    es: 'Cualquiera',
  },
  'layout.supportAccessRoleHint': {
    en: 'Leave as Any to list everyone with a linked login; pick a role to narrow the list.',
    es: 'Deje en Cualquiera para ver a todos con inicio de sesión vinculado; elija un rol para filtrar.',
  },
  'layout.supportErrorDetails': {
    en: 'Error details (select text or use Copy)',
    es: 'Detalles del error (selecciona el texto o usa Copiar)',
  },
  'layout.supportCopyDetails': {
    en: 'Copy',
    es: 'Copiar',
  },
  'layout.supportCopied': {
    en: 'Copied to clipboard',
    es: 'Copiado al portapapeles',
  },
  'layout.supportInvokeFailedShort': {
    en: 'Support sign-in failed — see details below.',
    es: 'Error al iniciar sesión de soporte — vea los detalles abajo.',
  },
  'layout.supportPickStaff': {
    en: 'Staff member',
    es: 'Miembro del equipo',
  },
  'layout.supportSearchStaff': {
    en: 'Search staff…',
    es: 'Buscar personal…',
  },
  'layout.supportStartSession': {
    en: 'Start support session',
    es: 'Iniciar sesión de soporte',
  },
  'layout.supportNoLinkedLogin': {
    en: 'No staff in this business have a linked login.',
    es: 'Nadie en este negocio tiene inicio de sesión vinculado.',
  },
  'layout.supportStaffFilterEmpty': {
    en: 'No staff match this filter — try “Any” or another role.',
    es: 'Nadie coincide con el filtro — prueba “Cualquiera” u otro rol.',
  },
  'layout.supportSessionBanner': {
    en: 'Support view: you are signed in as',
    es: 'Vista de soporte: has iniciado sesión como',
  },
  'layout.supportExitSession': {
    en: 'Exit support view',
    es: 'Salir de vista de soporte',
  },
  'layout.supportNeedBusiness': {
    en: 'Select a business first.',
    es: 'Selecciona un negocio primero.',
  },
  'layout.supportNeedStaff': {
    en: 'Select a staff member with a linked account.',
    es: 'Selecciona un miembro del equipo con cuenta vinculada.',
  },
  'layout.demoProfileMenuHint': {
    en: 'You are not signed in. This is a read-only tour with sample data.',
    es: 'No has iniciado sesión. Es un recorrido de solo lectura con datos de ejemplo.',
  },
  'layout.accountLabel': {
    en: 'Account',
    es: 'Cuenta',
  },
  'layout.woofButton': {
    en: 'Woof!',
    es: 'Woof!',
  },
  'layout.woofCooldownTooltip': {
    en: 'Woof woof!',
    es: '¡Woof woof!',
  },
  'businessSettings.demoKioskGeofenceNote': {
    en: 'Kiosk PIN, geofencing, and similar options are available after you sign in with an account.',
    es: 'El PIN del quiosco, geocercas y opciones similares están disponibles después de iniciar sesión con una cuenta.',
  },
  'settings.backToMain': {
    en: 'Back to main',
    es: 'Volver al inicio'
  },

  'transactions.newTransaction': { en: 'New Transaction', es: 'Nueva transacción' },
  'transactions.customer': { en: 'Customer', es: 'Cliente' },
  'transactions.searchCustomer': { en: 'Search customer...', es: 'Buscar cliente...' },
  'transactions.noCustomers': { en: 'No customers found', es: 'No se encontraron clientes' },
  'transactions.lineItems': { en: 'Line items', es: 'Líneas' },
  'transactions.addItemsHint': { en: 'Add services or products above', es: 'Agrega servicios o productos arriba' },
  'transactions.insufficientStock': { en: 'Insufficient stock', es: 'Stock insuficiente' },
  'transactions.adjustments': { en: 'Adjustments', es: 'Ajustes' },
  'transactions.discount': { en: 'Discount', es: 'Descuento' },
  'transactions.discountLabel': { en: 'Discount label', es: 'Etiqueta del descuento' },
  'transactions.tip': { en: 'Tip', es: 'Propina' },
  'transactions.summary': { en: 'Summary', es: 'Resumen' },
  'transactions.subtotal': { en: 'Subtotal', es: 'Subtotal' },
  'transactions.tax': { en: 'Tax', es: 'Impuesto' },
  'transactions.total': { en: 'Total', es: 'Total' },
  'transactions.amountPaid': { en: 'Amount Paid', es: 'Monto pagado' },
  'transactions.totalDue': { en: 'Total Due', es: 'Total a pagar' },
  'transactions.payment': { en: 'Payment', es: 'Pago' },
  'transactions.paymentMethod': { en: 'Payment method', es: 'Método de pago' },
  'transactions.amountTendered': { en: 'Amount tendered', es: 'Monto entregado' },
  'transactions.amountTenderedIncludesTaxTip': {
    en: 'Default matches total due below (subtotal after discount, tax, and tip).',
    es: 'Por defecto coincide con el total inferior (subtotal tras descuento, impuesto y propina).',
  },
  'transactions.changeDue': { en: 'Change due', es: 'Cambio' },
  'transactions.notes': { en: 'Notes', es: 'Notas' },
  'transactions.notesPlaceholder': { en: 'Optional internal note', es: 'Nota interna opcional' },
  'transactions.saveTransaction': { en: 'Save transaction', es: 'Guardar transacción' },
  'transactions.created': { en: 'Transaction created', es: 'Transacción creada' },
  'transactions.emptyListHint': {
    en: 'No transactions yet. Create one using New Transaction.',
    es: 'Aún no hay transacciones. Crea una con Nueva transacción.',
  },
  'transactions.searchPlaceholder': {
    en: 'Search by transaction ID, customer name, or amount...',
    es: 'Buscar por ID de transacción, cliente o monto...',
  },
  'transactions.noSearchResults': {
    en: 'No transactions match your search.',
    es: 'Ninguna transacción coincide con tu búsqueda.',
  },
  'transactions.addAtLeastOneItem': { en: 'Add at least one line item', es: 'Agrega al menos un ítem' },
  'transactions.receipt': { en: 'Receipt', es: 'Recibo' },
  'transactions.invoice': { en: 'Invoice', es: 'Factura' },
  'transactions.view': { en: 'View', es: 'Ver' },
  'transactions.print': { en: 'Print', es: 'Imprimir' },
  'transactions.email': { en: 'Email', es: 'Enviar por correo' },
  'transactions.sendTo': { en: 'Send to', es: 'Enviar a' },
  'transactions.printReceipt': { en: 'Print receipt', es: 'Imprimir recibo' },
  'transactions.printInvoice': { en: 'Print invoice', es: 'Imprimir factura' },
  'transactions.emailReceipt': { en: 'Email receipt', es: 'Enviar recibo por correo' },
  'transactions.issueRefund': { en: 'Issue refund', es: 'Emitir reembolso' },
  'transactions.void': { en: 'Void', es: 'Anular' },
  'transactions.detail': { en: 'Transaction detail', es: 'Detalle de transacción' },
  'transactions.refundAmount': { en: 'Refund amount ($)', es: 'Monto a reembolsar ($)' },
  'transactions.refundReason': { en: 'Reason', es: 'Motivo' },
  'transactions.returnToInventory': { en: 'Return items to inventory?', es: '¿Devolver ítems al inventario?' },
  'transactions.backToList': { en: 'Back to transactions', es: 'Volver a transacciones' },
  'transactions.date': { en: 'Date', es: 'Fecha' },
  'transactions.item': { en: 'Item', es: 'Ítem' },
  'transactions.qty': { en: 'Qty', es: 'Cant.' },
  'transactions.price': { en: 'Price', es: 'Precio' },
  'transactions.lineTotal': { en: 'Total', es: 'Total' },
  'transactions.voided': { en: 'Transaction voided', es: 'Transacción anulada' },
  'transactions.refundIssued': { en: 'Refund issued', es: 'Reembolso emitido' },
  'transactions.markAsPaid': { en: 'Mark as paid', es: 'Marcar como pagado' },
  'transactions.markedAsPaid': { en: 'Marked as paid', es: 'Marcado como pagado' },
  'transactions.refundAmountRequired': { en: 'Enter refund amount', es: 'Ingresa el monto a reembolsar' },
  'transactions.refundExceedsTotal': { en: 'Refund cannot exceed transaction total', es: 'El reembolso no puede superar el total' },
  'transactions.noEmailForCustomer': { en: 'No email on file for this customer', es: 'No hay correo registrado para este cliente' },
  'transactions.walkInEmailDescription': { en: 'Enter the customer’s email to open your mail client and send the receipt.', es: 'Ingresa el correo del cliente para abrir tu correo y enviar el recibo.' },
  'transactions.emailAddress': { en: 'Email address', es: 'Correo electrónico' },
  'transactions.sendReceipt': { en: 'Send receipt', es: 'Enviar recibo' },
  'transactions.enterEmail': { en: 'Please enter an email address', es: 'Ingresa una dirección de correo' },
  'transactions.invalidEmail': { en: 'Please enter a valid email address', es: 'Ingresa una dirección de correo válida' },
  'transactions.history': { en: 'Transaction history', es: 'Historial de la transacción' },
  'transactions.historyDescription': { en: 'When the transaction was created, amount changed to paid, etc.', es: 'Cuándo se creó la transacción, monto cambiado a pagado, etc.' },
  'transactions.historyCreated': { en: 'Transaction created', es: 'Transacción creada' },

  'accountSettings.description': { en: 'Manage your account and preferences', es: 'Administra tu cuenta y preferencias' },
  'accountSettings.demoProfileTitle': { en: 'Demo profile', es: 'Perfil de demostración' },
  'accountSettings.demoProfileDescription': {
    en: 'You are exploring Grumi without signing in. The app shows sample business data. Appearance and some fields can be changed here, but they are stored only in this browser until you create an account.',
    es: 'Estás explorando Grumi sin iniciar sesión. La app muestra datos de ejemplo del negocio. Puedes cambiar la apariencia y algunos campos aquí, pero se guardan solo en este navegador hasta que crees una cuenta.',
  },
  'accountSettings.demoProfileDisplayName': { en: 'Display name', es: 'Nombre mostrado' },
  'accountSettings.demoProfileDisplayNameValue': { en: 'Demo manager (preview)', es: 'Gerente demo (vista previa)' },
  'accountSettings.demoProfileRole': { en: 'Role', es: 'Rol' },
  'accountSettings.demoProfileRoleValue': { en: 'Manager (full sample workspace)', es: 'Gerente (espacio de muestra completo)' },
  'accountSettings.demoProfileEmail': { en: 'Email', es: 'Correo' },
  'accountSettings.demoProfileEmailValue': { en: 'Not signed in — no account email', es: 'Sin sesión — sin correo de cuenta' },
  'accountSettings.demoPasswordNote': {
    en: 'Password and account security are available after you sign up or log in.',
    es: 'La contraseña y la seguridad de la cuenta están disponibles después de registrarte o iniciar sesión.',
  },
  'accountSettings.language': { en: 'Language', es: 'Idioma' },
  'accountSettings.languageDescription': { en: 'Choose your preferred language for the app', es: 'Elige el idioma de la aplicación' },
  'accountSettings.selectLanguage': { en: 'Select language', es: 'Seleccionar idioma' },
  'accountSettings.saveLanguage': { en: 'Save', es: 'Guardar' },
  'accountSettings.languageSavedRefresh': { en: 'Language saved. Refreshing to apply changes…', es: 'Idioma guardado. Actualizando para aplicar los cambios…' },
  'accountSettings.staffBirthdayTitle': { en: 'Your birthday (staff profile)', es: 'Tu cumpleaños (perfil de personal)' },
  'accountSettings.staffBirthdayDescription': {
    en: 'Stored on your staff record so birthday notifications work the same as for your team.',
    es: 'Se guarda en tu registro de personal para que las notificaciones de cumpleaños funcionen igual que para tu equipo.',
  },
  'accountSettings.staffBirthdaySave': { en: 'Save birthday', es: 'Guardar cumpleaños' },
  'accountSettings.staffBirthdaySaved': { en: 'Birthday saved', es: 'Cumpleaños guardado' },
  'accountSettings.staffBirthdayNeedStaffLinkTitle': {
    en: 'Link your account to a staff profile',
    es: 'Vincula tu cuenta a un perfil de personal',
  },
  'accountSettings.staffBirthdayNeedStaffLinkBody': {
    en: 'Your user account is not linked to a staff row yet, so your birthday cannot be saved here. Ask an admin to link your profile to your staff record, or open Staff and ensure you appear as a staff member with the same email.',
    es: 'Tu cuenta aún no está vinculada a un registro de personal, así que no se puede guardar el cumpleaños aquí. Pide a un administrador que vincule tu perfil o revisa en Personal que existas como miembro.',
  },
  'accountSettings.staffBirthdayNeedStaffLinkCta': {
    en: 'Open Staff',
    es: 'Abrir Personal',
  },
  'accountSettings.colorPalette': { en: 'Color palette', es: 'Paleta de colores' },
  'accountSettings.colorPaletteDescription': { en: 'Set a primary brand color (HSL values, e.g. 127 18% 47% for olive #6B8B70)', es: 'Establece un color de marca primario' },
  'accountSettings.primaryColor': { en: 'Primary color', es: 'Color primario' },
  'accountSettings.secondaryColor': { en: 'Secondary / Accent color', es: 'Color secundario / acento' },
  'accountSettings.colorPicker': { en: 'Color picker', es: 'Selector de color' },
  'accountSettings.standardThemes': { en: 'Standard themes', es: 'Temas estándar' },
  'accountSettings.colorSaved': { en: 'Color saved', es: 'Color guardado' },
  'accountSettings.changePassword': { en: 'Change password', es: 'Cambiar contraseña' },
  'accountSettings.currentPassword': { en: 'Current password', es: 'Contraseña actual' },
  'accountSettings.currentPasswordRequired': { en: 'Enter your current password', es: 'Ingresa tu contraseña actual' },
  'accountSettings.currentPasswordVerified': { en: 'Password verified', es: 'Contraseña verificada' },
  'accountSettings.verifyCurrentPassword': { en: 'Verify', es: 'Verificar' },
  'accountSettings.changePasswordDescription': { en: 'Set a new password for your account', es: 'Establece una nueva contraseña' },
  'accountSettings.newPassword': { en: 'New password', es: 'Nueva contraseña' },
  'accountSettings.confirmPassword': { en: 'Confirm password', es: 'Confirmar contraseña' },
  'accountSettings.passwordMismatch': { en: 'Passwords do not match', es: 'Las contraseñas no coinciden' },
  'accountSettings.passwordTooShort': { en: 'Password must be at least 6 characters', es: 'La contraseña debe tener al menos 6 caracteres' },
  'accountSettings.passwordUpdated': { en: 'Password updated', es: 'Contraseña actualizada' },
  'accountSettings.updatePassword': { en: 'Update password', es: 'Actualizar contraseña' },
  'accountSettings.navOrder': { en: 'Navigation order', es: 'Orden de navegación' },
  'accountSettings.navOrderDescription': { en: 'Drag to reorder header menu items', es: 'Arrastra para reordenar el menú' },
  'accountSettings.navOrderComingSoon': { en: 'Custom navigation order coming soon.', es: 'Orden de navegación personalizado próximamente.' },

  'businessSettings.description': { en: 'Tax, receipts, payment, and business data', es: 'Impuestos, recibos, pago y datos del negocio' },
  'businessSettings.businessName': { en: 'Business name', es: 'Nombre del negocio' },
  'businessSettings.publicUrl': { en: 'Public URL', es: 'URL pública' },
  'businessSettings.publicUrlHint': {
    en: 'Used in your portal link: yoursite.com/{slug}/… Letters, numbers, and hyphens only. Changing this updates shared links.',
    es: 'Se usa en el enlace del portal: tudominio.com/{slug}/… Solo letras, números y guiones. Al cambiarla se actualizan los enlaces compartidos.',
  },
  'businessSettings.slugSuggestFromName': { en: 'Suggest from name', es: 'Sugerir según el nombre' },
  'businessSettings.slugInvalid': {
    en: 'Use 2–80 characters: lowercase letters, numbers, and single hyphens (no spaces or special characters).',
    es: 'Usa 2–80 caracteres: letras minúsculas, números y guiones simples (sin espacios ni caracteres especiales).',
  },
  'businessSettings.slugReserved': {
    en: 'This URL is reserved. Please choose a different one.',
    es: 'Esta URL está reservada. Elige otra.',
  },
  'businessSettings.slugTaken': {
    en: 'Another business already uses this URL. Try a variation.',
    es: 'Otro negocio ya usa esta URL. Prueba una variación.',
  },
  'businessSettings.slugCheckChecking': { en: 'Checking availability…', es: 'Comprobando disponibilidad…' },
  'businessSettings.slugCheckAvailable': { en: 'This URL is available.', es: 'Esta URL está disponible.' },
  'businessSettings.slugCheckCurrent': { en: 'This is your current URL.', es: 'Esta es tu URL actual.' },
  'businessSettings.slugCheckInvalidShort': {
    en: 'Use 2–80 characters: lowercase letters, numbers, and hyphens only.',
    es: 'Usa 2–80 caracteres: solo minúsculas, números y guiones.',
  },
  'businessSettings.slugCheckReservedShort': {
    en: 'This URL is reserved for the app.',
    es: 'Esta URL está reservada para la aplicación.',
  },
  'businessSettings.businessHours': { en: 'Business hours', es: 'Horario' },
  'businessSettings.phone': { en: 'Phone', es: 'Teléfono' },
  'businessSettings.address': { en: 'Address', es: 'Dirección' },
  'businessSettings.businessInfoSaved': { en: 'Business info saved', es: 'Información guardada' },
  'businessSettings.generalBusinessSaved': { en: 'General business settings saved', es: 'Configuración general guardada' },
  'businessSettings.refreshingPublicUrl': {
    en: 'Refreshing public URL…',
    es: 'Actualizando la URL pública…',
  },
  'businessSettings.businessHoursSaved': { en: 'Business hours saved', es: 'Horario guardado' },
  'businessSettings.brandingLayoutSaved': { en: 'Logo layout saved', es: 'Diseño del logo guardado' },
  'businessSettings.brandingLightSection': { en: 'Light mode', es: 'Modo claro' },
  'businessSettings.brandingLightSectionHint': {
    en: 'Main logo for the expanded sidebar and punch clock. Icon for collapsed sidebar and mobile menu.',
    es: 'Logo principal para la barra expandida y el reloj. Icono para la barra colapsada y el menú móvil.',
  },
  'businessSettings.brandingDarkSection': { en: 'Dark mode (optional)', es: 'Modo oscuro (opcional)' },
  'businessSettings.brandingDarkSectionHint': {
    en: 'Leave empty to use the light mode images in dark theme.',
    es: 'Déjalo vacío para usar las imágenes del modo claro en tema oscuro.',
  },
  'businessSettings.brandingLogo': { en: 'Logo', es: 'Logo' },
  'businessSettings.brandingIcon': { en: 'Icon', es: 'Icono' },
  'businessSettings.brandingLogoDark': { en: 'Logo (dark)', es: 'Logo (oscuro)' },
  'businessSettings.brandingIconDark': { en: 'Icon (dark)', es: 'Icono (oscuro)' },
  'businessSettings.brandingAdjustTitle': { en: 'Adjust branding', es: 'Ajustar marca' },
  'businessSettings.brandingTabCrop': { en: 'Crop (saved file)', es: 'Recorte (archivo guardado)' },
  'businessSettings.brandingTabAppearance': { en: 'Appearance', es: 'Apariencia' },
  'businessSettings.brandingPreviewSidebarExpanded': { en: 'Sidebar (expanded)', es: 'Barra (expandida)' },
  'businessSettings.brandingPreviewKiosk': { en: 'Punch clock', es: 'Reloj de fichaje' },
  'businessSettings.brandingPreviewCollapsed': { en: 'Sidebar (collapsed)', es: 'Barra (colapsada)' },
  'businessSettings.brandingPreviewMobile': { en: 'Mobile header', es: 'Encabezado móvil' },
  'businessSettings.brandingZoom': { en: 'Zoom', es: 'Zoom' },
  'businessSettings.brandingHeightPx': { en: 'Height (px)', es: 'Alto (px)' },
  'businessSettings.brandingMaxWidthPx': { en: 'Max width (px)', es: 'Ancho máx. (px)' },
  'businessSettings.brandingKioskHeightPx': { en: 'Logo height (px)', es: 'Alto del logo (px)' },
  'businessSettings.brandingSizePx': { en: 'Size (px)', es: 'Tamaño (px)' },
  'businessSettings.brandingCropHint': {
    en: 'Zoom changes how much of the image is saved when you confirm (larger zoom = tighter crop).',
    es: 'El zoom cambia cuánto de la imagen se guarda al confirmar (más zoom = recorte más cerrado).',
  },
  'businessSettings.brandingEditNeedImage': {
    en: 'Upload an image first.',
    es: 'Sube una imagen primero.',
  },
  'businessSettings.brandingColorsSaved': { en: 'Brand colors saved', es: 'Colores de marca guardados' },
  'businessSettings.brandingThemePreviewApplied': { en: 'Preview applied', es: 'Vista previa aplicada' },
  'businessSettings.brandingThemeHint': {
    en: 'Click a theme to preview. Save below to apply for everyone in this business.',
    es: 'Haz clic en un tema para previsualizar. Guarda abajo para aplicarlo a todos en el negocio.',
  },
  'businessSettings.pageNavAria': { en: 'Business settings sections', es: 'Secciones de configuración del negocio' },
  'businessSettings.onThisPage': { en: 'On this page', es: 'En esta página' },
  'businessSettings.navGeneral': { en: 'General Settings', es: 'Configuración general' },
  'businessSettings.navBusinessHours': { en: 'Business hours', es: 'Horario' },
  'businessSettings.navBranding': { en: 'Branding', es: 'Marca' },
  'businessSettings.navInventory': { en: 'Inventory', es: 'Inventario' },
  'businessSettings.navPayroll': { en: 'Payroll', es: 'Nómina' },
  'businessSettings.navTax': { en: 'Tax configuration', es: 'Impuestos' },
  'businessSettings.navReceipts': { en: 'Receipts', es: 'Recibos' },
  'businessSettings.navPayment': { en: 'Payment setup', es: 'Pagos' },
  'businessSettings.navPayments': { en: 'Payments', es: 'Pagos' },
  'businessSettings.navDataExport': { en: 'Data export', es: 'Exportar datos' },
  'businessSettings.sectionGeneralTitle': { en: 'General Settings', es: 'Configuración general' },
  'businessSettings.sectionGeneralDescription': {
    en: 'Business name, public URL, contact, and timezone.',
    es: 'Nombre del negocio, URL pública, contacto y zona horaria.',
  },
  'businessSettings.sectionInventoryTitle': { en: 'Inventory', es: 'Inventario' },
  'businessSettings.sectionDataExportTitle': { en: 'Data export', es: 'Exportar datos' },
  'businessSettings.sectionPayrollTitle': { en: 'Payroll', es: 'Nómina' },
  'businessSettings.sectionPayrollDescription': {
    en: 'Pay periods, punch clock, timesheets, kiosk access, and geofencing for time tracking.',
    es: 'Períodos de pago, reloj de fichaje, hojas de tiempo, acceso al quiosco y geocerca para el control de tiempo.',
  },
  'businessSettings.punchClockHeading': { en: 'Punch clock', es: 'Reloj de fichaje' },
  'businessSettings.punchClockDescription': {
    en: 'How employees clock in on the punch clock and their own devices.',
    es: 'Cómo fichan los empleados en el reloj y en sus propios dispositivos.',
  },
  'businessSettings.kioskManagerHeading': { en: 'Kiosk manager', es: 'Administrador del quiosco' },
  'businessSettings.geofencingHeading': { en: 'Geofencing', es: 'Geocerca' },
  'businessSettings.sectionHoursTitle': { en: 'Business hours', es: 'Horario del negocio' },
  'businessSettings.sectionHoursDescription': {
    en: 'Hours shown on your portal and used where schedules apply.',
    es: 'Horario visible en el portal y donde aplique la agenda.',
  },
  'businessSettings.sectionBrandingTitle': { en: 'Branding', es: 'Marca' },
  'businessSettings.sectionBrandingDescription': {
    en: 'Logo and colors apply to all users in this business.',
    es: 'El logo y los colores aplican a todos los usuarios de este negocio.',
  },
  'businessSettings.timezoneLabel': { en: 'Business timezone', es: 'Zona horaria del negocio' },
  'businessSettings.timezoneHint': {
    en: 'Should match your local business time.',
    es: 'Debe coincidir con la hora local del negocio.',
  },
  'businessSettings.timezonePlaceholder': { en: 'Select timezone', es: 'Seleccionar zona horaria' },
  'businessSettings.timezoneSearchPlaceholder': { en: 'Search city or region…', es: 'Buscar ciudad o región…' },
  'businessSettings.timezoneNoResults': { en: 'No matching timezone.', es: 'Sin resultados.' },
  'businessSettings.colorPaletteSection': { en: 'Color palette', es: 'Paleta de colores' },
  'businessSettings.colorPaletteSectionDescription': {
    en: 'Primary and accent colors for the app for everyone in this workspace.',
    es: 'Colores principal y de acento para la app para todos en este espacio.',
  },
  'businessSettings.navbarLogoMode': { en: 'Navbar logo mode', es: 'Modo del logo en barra' },
  'businessSettings.navbarLogoModeSquare': { en: 'Square', es: 'Cuadrado' },
  'businessSettings.navbarLogoModeWide': { en: 'Wide (wordmark)', es: 'Ancho (wordmark)' },
  'businessSettings.navbarLogoSize': { en: 'Navbar logo size (px)', es: 'Tamaño del logo (px)' },
  'businessSettings.saveLogoLayout': { en: 'Save logo layout', es: 'Guardar diseño del logo' },
  'businessSettings.logoLightMode': { en: 'Light mode', es: 'Modo claro' },
  'businessSettings.logoDarkMode': { en: 'Dark mode', es: 'Modo oscuro' },
  'businessSettings.taxConfiguration': { en: 'Tax configuration', es: 'Configuración de impuestos' },
  'businessSettings.taxConfigurationDescription': { en: 'Choose a region or custom taxes. They will appear on receipts as specified.', es: 'Elige una región o impuestos personalizados. Aparecerán en los recibos como se indique.' },
  'businessSettings.taxMode': { en: 'Tax setup', es: 'Configuración de impuestos' },
  'businessSettings.taxModeRegion': { en: 'Region', es: 'Región' },
  'businessSettings.taxModeCustom': { en: 'Custom', es: 'Personalizado' },
  'businessSettings.taxRegion': { en: 'Region', es: 'Región' },
  'businessSettings.taxRegionPuertoRico': { en: 'Puerto Rico', es: 'Puerto Rico' },
  'businessSettings.taxNamePlaceholder': { en: 'e.g. State Tax, Municipal Tax', es: 'ej. Impuesto estatal, Impuesto municipal' },
  'businessSettings.taxAppliesBoth': { en: 'Services & products', es: 'Servicios y productos' },
  'businessSettings.taxAppliesService': { en: 'Services only', es: 'Solo servicios' },
  'businessSettings.taxAppliesProduct': { en: 'Products only', es: 'Solo productos' },
  'businessSettings.taxAddAnother': { en: 'Add another tax', es: 'Agregar otro impuesto' },
  'businessSettings.taxCustomNone': { en: 'No custom taxes. Add one above.', es: 'Sin impuestos personalizados. Agrega uno arriba.' },
  'businessSettings.taxSaved': { en: 'Tax settings saved', es: 'Configuración de impuestos guardada' },
  'businessSettings.taxSaveEmpty': { en: 'Select a region or add at least one custom tax.', es: 'Selecciona una región o agrega al menos un impuesto personalizado.' },
  'businessSettings.receiptCustomization': { en: 'Receipt customization', es: 'Personalización de recibos' },
  'businessSettings.receiptCustomizationDescription': { en: 'Header, footer, and receipt preview', es: 'Encabezado, pie y vista previa' },
  'businessSettings.receiptHeader': { en: 'Header text', es: 'Texto del encabezado' },
  'businessSettings.receiptHeaderPlaceholder': { en: 'Business name, tagline...', es: 'Nombre del negocio, eslogan...' },
  'businessSettings.receiptFooter': { en: 'Footer text', es: 'Texto del pie' },
  'businessSettings.receiptFooterPlaceholder': { en: 'Thank you message, return policy...', es: 'Mensaje de agradecimiento, política de devolución...' },
  'businessSettings.companyLogo': { en: 'Company logo', es: 'Logo de la empresa' },
  'businessSettings.logoNoImage': { en: 'No logo', es: 'Sin logo' },
  'businessSettings.logoUpload': { en: 'Upload logo', es: 'Subir logo' },
  'businessSettings.logoReplace': { en: 'Replace', es: 'Reemplazar' },
  'businessSettings.logoDelete': { en: 'Delete', es: 'Eliminar' },
  'businessSettings.logoZoomIn': { en: 'Zoom in', es: 'Acercar' },
  'businessSettings.logoZoomOut': { en: 'Zoom out', es: 'Alejar' },
  'businessSettings.logoMax5MB': { en: 'Image, max 5 MB', es: 'Imagen, máx. 5 MB' },
  'businessSettings.logoImageOnly': { en: 'Please choose an image file (JPEG, PNG, WebP, GIF).', es: 'Elige un archivo de imagen (JPEG, PNG, WebP, GIF).' },
  'businessSettings.logoMax5MBError': { en: 'Image must be 5 MB or smaller.', es: 'La imagen debe ser de 5 MB o menos.' },
  'businessSettings.logoUploaded': { en: 'Logo updated', es: 'Logo actualizado' },
  'businessSettings.logoDeleted': { en: 'Logo removed', es: 'Logo eliminado' },
  'businessSettings.logoAdjustPreview': { en: 'Adjust logo (zoom to reduce margins)', es: 'Ajustar logo (zoom para reducir márgenes)' },
  'businessSettings.logoUseThis': { en: 'Use this', es: 'Usar esta' },
  'businessSettings.closed': { en: 'Closed', es: 'Cerrado' },
  'businessSettings.day.monday': { en: 'Monday', es: 'Lunes' },
  'businessSettings.day.tuesday': { en: 'Tuesday', es: 'Martes' },
  'businessSettings.day.wednesday': { en: 'Wednesday', es: 'Miércoles' },
  'businessSettings.day.thursday': { en: 'Thursday', es: 'Jueves' },
  'businessSettings.day.friday': { en: 'Friday', es: 'Viernes' },
  'businessSettings.day.saturday': { en: 'Saturday', es: 'Sábado' },
  'businessSettings.day.sunday': { en: 'Sunday', es: 'Domingo' },
  'businessSettings.receiptSaved': { en: 'Receipt settings saved', es: 'Configuración de recibo guardada' },
  'businessSettings.paymentSetup': { en: 'Payment setup', es: 'Configuración de pago' },
  'businessSettings.paymentSetupDescription': { en: 'Stripe and ATH Móvil', es: 'Stripe y ATH Móvil' },
  'businessSettings.paymentsTitle': { en: 'Payments', es: 'Pagos' },
  'businessSettings.paymentsDescription': {
    en: 'Stripe, ATH Móvil, PayPal, and other payment methods.',
    es: 'Stripe, ATH Móvil, PayPal y otros métodos de pago.',
  },
  'businessSettings.paymentStripePlaceholder': { en: 'Credit Card (Stripe): connect account and API keys — coming soon.', es: 'Tarjeta (Stripe): conectar cuenta y API — próximamente.' },
  'businessSettings.paymentATHPlaceholder': { en: 'ATH Móvil: business phone and token — coming soon.', es: 'ATH Móvil: teléfono y token — próximamente.' },
  'businessSettings.lowStockGlobal': { en: 'Default low-stock threshold', es: 'Umbral de stock bajo por defecto' },
  'businessSettings.lowStockGlobalDescription': { en: 'Applied to all products unless overridden per product (default 5).', es: 'Aplicado a todos los productos salvo que se sobrescriba (default 5).' },
  'businessSettings.defaultLowStock': { en: 'Default threshold', es: 'Umbral por defecto' },
  'businessSettings.lowStockSaved': { en: 'Low-stock threshold saved', es: 'Umbral de stock bajo guardado' },
  'businessSettings.dataExport': { en: 'Data export', es: 'Exportar datos' },
  'businessSettings.dataExportDescription': { en: 'Download business data (CSV). For multi-sheet Excel (XLSX), add exceljs or xlsx dependency.', es: 'Descargar datos del negocio (CSV). Para Excel (XLSX), agregar dependencia exceljs o xlsx.' },
  'businessSettings.downloadData': { en: 'Download business data (CSV)', es: 'Descargar datos (CSV)' },
  'businessSettings.exportSuccess': { en: 'Export downloaded', es: 'Exportación descargada' },

  'bookingSettings.description': { en: 'Services, availability, and booking window', es: 'Servicios, disponibilidad y ventana de reservas' },
  'bookingSettings.servicesOffered': { en: 'Services offered', es: 'Servicios ofrecidos' },
  'bookingSettings.servicesOfferedDescription': { en: 'Configure bookable services', es: 'Configura los servicios reservables' },
  'bookingSettings.availability': { en: 'Availability', es: 'Disponibilidad' },
  'bookingSettings.availabilityDescription': { en: 'Hours and booking window', es: 'Horas y ventana de reserva' },
  'bookingSettings.bookingWindow': { en: 'Booking window', es: 'Ventana de reserva' },
  'bookingSettings.bufferTime': { en: 'Buffer time', es: 'Tiempo de búfer' },
  'bookingSettings.comingSoon': { en: 'Full booking logic in a later phase.', es: 'Lógica de reservas en una fase posterior.' },
  'bookingSettings.options': { en: 'Booking options', es: 'Opciones de reserva' },
  'bookingSettings.optionsDescription': { en: 'Control when and how clients can book', es: 'Controla cuándo y cómo los clientes pueden reservar' },
  'bookingSettings.allowOutsideHours': { en: 'Allow booking outside employee working hours', es: 'Permitir reservas fuera del horario laboral' },
  'bookingSettings.allowOutsideHoursDescription': { en: 'Clients can book slots outside staff schedules', es: 'Los clientes pueden reservar fuera del horario del personal' },
  'bookingSettings.allowSameDay': { en: 'Allow same-day booking', es: 'Permitir reservas el mismo día' },
  'bookingSettings.allowSameDayDescription': { en: 'Allow appointments to be booked for today', es: 'Permitir citas para el día de hoy' },
  'bookingSettings.requireDeposit': { en: 'Require deposit for online bookings', es: 'Requerir depósito para reservas en línea' },
  'bookingSettings.requireDepositDescription': { en: 'Collect a deposit when booking online', es: 'Cobrar depósito al reservar en línea' },

  'billing.title': { en: 'Billing & Subscription', es: 'Facturación y suscripción' },
  'billing.description': { en: 'Plan, payment method, and invoices', es: 'Plan, método de pago e facturas' },
  'billing.currentPlan': { en: 'Current plan', es: 'Plan actual' },
  'billing.standardPlan': { en: 'Standard', es: 'Estándar' },
  'billing.planPlaceholder': { en: 'Your current plan will appear here.', es: 'Tu plan actual aparecerá aquí.' },
  'billing.renewalPlaceholder': { en: 'Renewal date and payment method on file.', es: 'Fecha de renovación y método de pago.' },
  'billing.upgradeDowngrade': { en: 'Upgrade / Downgrade', es: 'Subir / Bajar plan' },
  'billing.invoiceHistory': { en: 'Invoice history', es: 'Historial de facturas' },
  'billing.date': { en: 'Date', es: 'Fecha' },
  'billing.amount': { en: 'Amount', es: 'Monto' },
  'billing.status': { en: 'Status', es: 'Estado' },
  'billing.download': { en: 'Download', es: 'Descargar' },
  'billing.noInvoices': { en: 'No invoices yet.', es: 'Aún no hay facturas.' },

  'help.description': { en: 'Contact us with any questions.', es: 'Contáctanos con cualquier pregunta.' },
  'help.contactSupport': { en: 'Contact support', es: 'Contactar soporte' },
  'help.contactSupportDescription': { en: 'Send us a message', es: 'Envíanos un mensaje' },
  'help.yourName': { en: 'Name', es: 'Nombre' },
  'help.yourEmail': { en: 'Email', es: 'Correo' },
  'help.subject': { en: 'Subject', es: 'Asunto' },
  'help.message': { en: 'Message', es: 'Mensaje' },
  'help.submit': { en: 'Submit', es: 'Enviar' },
  'help.messageSent': { en: 'Message sent. We will get back to you.', es: 'Mensaje enviado. Te responderemos.' },
  'help.contactEmail': { en: 'Contact email', es: 'Correo de contacto' },
  'help.emailCopied': { en: 'Email copied to clipboard', es: 'Correo copiado al portapapeles' },
  'help.copy': { en: 'Copy', es: 'Copiar' },
  'help.sendMessage': { en: 'Send a message', es: 'Enviar un mensaje' },
  'help.formDescription': { en: 'Submit your question or feedback and we\'ll get back to you.', es: 'Envía tu pregunta o comentario y te responderemos.' },

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
  'common.continue': {
    en: 'Continue',
    es: 'Continuar'
  },
  'common.clear': {
    en: 'Clear',
    es: 'Borrar'
  },
  'common.na': {
    en: 'N/A',
    es: 'N/D'
  },
  'common.save': {
    en: 'Save',
    es: 'Guardar'
  },
  'common.saved': {
    en: 'Saved.',
    es: 'Guardado.'
  },
  'common.loading': {
    en: 'Loading...',
    es: 'Cargando...'
  },
  'common.switchingLanguage': {
    en: 'Updating language…',
    es: 'Actualizando idioma…'
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
  'common.tryAgain': {
    en: 'Try again',
    es: 'Intentar de nuevo'
  },
  'common.genericError': {
    en: 'Something went wrong. Please try again.',
    es: 'Algo salió mal. Por favor intenta de nuevo.'
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
  'clients.addPetForClient': {
    en: 'Add pet',
    es: 'Agregar mascota'
  },
  'clients.listActions': {
    en: 'Actions',
    es: 'Acciones'
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
  'clients.listName': {
    en: 'Name',
    es: 'Nombre'
  },
  'clients.listEmail': {
    en: 'Email',
    es: 'Correo'
  },
  'clients.listPhone': {
    en: 'Phone',
    es: 'Teléfono'
  },
  'clients.listPets': {
    en: 'Pets',
    es: 'Mascotas'
  },
  'clients.deleteClientTitle': {
    en: 'Delete client?',
    es: '¿Eliminar cliente?'
  },
  'clients.deleteClientDescription': {
    en: 'This will permanently delete this client. This action cannot be undone.',
    es: 'Se eliminará este cliente de forma permanente. Esta acción no se puede deshacer.'
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
  'pets.saveSuccess': {
    en: 'Pet saved successfully.',
    es: 'Mascota guardada exitosamente.'
  },
  'pets.updateSuccess': {
    en: 'Pet updated successfully.',
    es: 'Mascota actualizada exitosamente.'
  },
  'pets.saveError': {
    en: 'Could not save pet. Please try again.',
    es: 'No se pudo guardar la mascota. Por favor intente de nuevo.'
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
  'pets.listPhoto': {
    en: 'Photo',
    es: 'Foto'
  },
  'pets.listName': {
    en: 'Name',
    es: 'Nombre'
  },
  'pets.listOwner': {
    en: 'Owner',
    es: 'Dueño'
  },
  'pets.listOwnerPhone': {
    en: 'Owner phone',
    es: 'Tel. del dueño'
  },
  'pets.listBreed': {
    en: 'Breed',
    es: 'Raza'
  },
  'pets.listWeight': {
    en: 'Weight',
    es: 'Peso'
  },
  'pets.listLastAppointment': {
    en: 'Last appointment',
    es: 'Última cita'
  },
  'pets.listNextAppointment': {
    en: 'Next appointment',
    es: 'Próxima cita'
  },
  'pets.deletePetTitle': {
    en: 'Delete pet?',
    es: '¿Eliminar mascota?'
  },
  'pets.deletePetDescription': {
    en: 'This will permanently delete this pet. This action cannot be undone.',
    es: 'Se eliminará esta mascota de forma permanente. Esta acción no se puede deshacer.'
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
  'booking.pastTimeConfirm': {
    en: 'The selected date and time have already passed. Do you want to continue?',
    es: 'La fecha y hora seleccionadas ya pasaron. ¿Deseas continuar?',
  },
  'booking.pastConfirmTitle': {
    en: 'Past appointment',
    es: 'Cita en el pasado',
  },
  'booking.pastTimeHoverHint': {
    en: 'Past time period. Continue if you are recording a visit that already happened.',
    es: 'Periodo en el pasado. ¿Continuar?',
  },
  'booking.pastDateConfirm': {
    en: 'This day is in the past. Use this only if you are recording a visit that already happened. Continue?',
    es: 'Este día ya pasó. Úsalo solo si registras una visita que ya ocurrió. ¿Continuar?',
  },
  'booking.pastTimeSlotConfirm': {
    en: 'This time has already passed. Use this only if you are recording a visit that already happened. Continue?',
    es: 'Esta hora ya pasó. Úsala solo si registras una visita que ya ocurrió. ¿Continuar?',
  },
  'booking.closedThisDay': {
    en: 'Closed — choose another date.',
    es: 'Cerrado — elige otra fecha.',
  },
  'booking.noTimesInBusinessHours': {
    en: 'No times fit within business hours for this day.',
    es: 'No hay horarios dentro del horario del negocio para este día.',
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
  'services.searchPlaceholder': {
    en: 'Search services by name or description...',
    es: 'Buscar servicios por nombre o descripción...'
  },
  'services.noSearchResults': {
    en: 'No services match your search.',
    es: 'Ningún servicio coincide con tu búsqueda.'
  },
  'services.serviceAdded': {
    en: 'Service added successfully.',
    es: 'Servicio agregado exitosamente.'
  },
  'services.serviceUpdated': {
    en: 'Service updated successfully.',
    es: 'Servicio actualizado exitosamente.'
  },
  'services.addError': {
    en: 'Could not add service. Please try again.',
    es: 'No se pudo agregar el servicio. Por favor intente de nuevo.'
  },
  'services.updateError': {
    en: 'Could not update service. Please try again.',
    es: 'No se pudo actualizar el servicio. Por favor intente de nuevo.'
  },
  'services.saveError': {
    en: 'An error occurred while saving the service.',
    es: 'Ocurrió un error al guardar el servicio.'
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
  'inventory.allItems': {
    en: 'All items',
    es: 'Todos los artículos'
  },
  'inventory.folders': {
    en: 'Folders',
    es: 'Carpetas'
  },
  'inventory.newFolder': {
    en: 'New folder',
    es: 'Nueva carpeta'
  },
  'inventory.folderName': {
    en: 'Folder name',
    es: 'Nombre de carpeta'
  },
  'inventory.noFolders': {
    en: 'No folders yet',
    es: 'Aún no hay carpetas'
  },
  'inventory.tileView': {
    en: 'Tile view',
    es: 'Vista de tarjetas'
  },
  'inventory.listView': {
    en: 'List view',
    es: 'Vista de lista'
  },
  'inventory.lowStock': {
    en: 'Low stock',
    es: 'Stock bajo'
  },
  'inventory.stock': {
    en: 'Stock',
    es: 'Stock'
  },
  'inventory.inStock': {
    en: 'In stock',
    es: 'En stock'
  },
  'inventory.noBarcode': {
    en: 'No barcode',
    es: 'Sin código de barras'
  },
  'inventory.generateBarcode': {
    en: 'Generate barcode',
    es: 'Generar código'
  },
  'inventory.orderHistory': {
    en: 'Order history',
    es: 'Historial de pedidos'
  },
  'inventory.noOrderHistory': {
    en: 'No order history yet',
    es: 'Aún no hay historial de pedidos'
  },
  'inventory.searchPlaceholder': {
    en: 'Search by name, SKU, barcode, category...',
    es: 'Buscar por nombre, SKU, código, categoría...'
  },
  'inventory.stockFilterAll': {
    en: 'All stock',
    es: 'Todo el stock'
  },
  'inventory.stockFilterLow': {
    en: 'Low stock',
    es: 'Stock bajo'
  },
  'inventory.stockFilterInStock': {
    en: 'In stock',
    es: 'En stock'
  },
  'inventory.productName': {
    en: 'Product name',
    es: 'Nombre del producto'
  },
  'inventory.sku': {
    en: 'SKU',
    es: 'SKU'
  },
  'inventory.folder': {
    en: 'Folder',
    es: 'Carpeta'
  },
  'inventory.noFolder': {
    en: 'No folder',
    es: 'Sin carpeta'
  },
  'inventory.barcode': {
    en: 'Barcode',
    es: 'Código de barras'
  },
  'inventory.category': {
    en: 'Category',
    es: 'Categoría'
  },
  'inventory.supplier': {
    en: 'Supplier',
    es: 'Proveedor'
  },
  'inventory.quantity': {
    en: 'Quantity',
    es: 'Cantidad'
  },
  'inventory.reorderLevel': {
    en: 'Reorder level',
    es: 'Nivel de reorden'
  },
  'inventory.costPrice': {
    en: 'Cost',
    es: 'Costo'
  },
  'inventory.salePrice': {
    en: 'Sale price',
    es: 'Precio de venta'
  },
  'inventory.photoUrl': {
    en: 'Photo URL',
    es: 'URL de foto'
  },
  'inventory.productPhoto': {
    en: 'Product photo',
    es: 'Foto del producto'
  },
  'inventory.photoUrlPlaceholder': {
    en: 'Or paste image URL',
    es: 'O pega URL de imagen'
  },
  'inventory.validationNameRequired': {
    en: 'Product name is required',
    es: 'El nombre del producto es obligatorio'
  },
  'inventory.validationSkuRequired': {
    en: 'SKU is required',
    es: 'El SKU es obligatorio'
  },
  'inventory.validationSkuDuplicate': {
    en: 'SKU is already in use',
    es: 'El SKU ya está en uso'
  },
  'inventory.validationNegativeStock': {
    en: 'Stock quantity cannot be negative',
    es: 'La cantidad en stock no puede ser negativa'
  },
  'inventory.validationNegativePrice': {
    en: 'Price cannot be negative',
    es: 'El precio no puede ser negativo'
  },
  'inventory.validationNegativeCost': {
    en: 'Cost cannot be negative',
    es: 'El costo no puede ser negativo'
  },
  'inventory.duplicateSkuWarning': {
    en: 'This SKU already exists for another product.',
    es: 'Este SKU ya existe para otro producto.'
  },
  'inventory.duplicateSkuTitle': {
    en: 'Duplicate SKU',
    es: 'SKU duplicado'
  },
  'inventory.duplicateSkuDescription': {
    en: 'This SKU is already used by another product. Save anyway?',
    es: 'Este SKU ya está en uso por otro producto. ¿Guardar de todos modos?'
  },
  'inventory.saveAnyway': {
    en: 'Save anyway',
    es: 'Guardar de todos modos'
  },
  'inventory.productDescription': {
    en: 'Description',
    es: 'Descripción'
  },
  'inventory.notes': {
    en: 'Notes',
    es: 'Notas'
  },
  'inventory.productRegistry': {
    en: 'Product registry',
    es: 'Registro de productos'
  },
  'inventory.noResults': {
    en: 'No products match your filters.',
    es: 'No hay productos que coincidan con los filtros.'
  },
  'inventory.emptyState': {
    en: 'No products in this folder. Add your first product above!',
    es: 'No hay productos en esta carpeta. ¡Agrega tu primer producto arriba!'
  },
  'inventory.deleteTitle': {
    en: 'Delete product?',
    es: '¿Eliminar producto?'
  },
  'inventory.deleteDescription': {
    en: 'This will permanently delete this product. This action cannot be undone.',
    es: 'Se eliminará este producto de forma permanente. Esta acción no se puede deshacer.'
  },
  'inventory.moveTo': {
    en: 'Move to',
    es: 'Mover a'
  },

  // Employees/Time Tracking page
  'timeTracking.title': {
    en: 'Punch Clock',
    es: 'Ponchador'
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
  'nav.timeKiosk': {
    en: 'Punch Clock',
    es: 'Ponchador'
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
  'dashboard.todayAppointments': {
    en: "Today's Appointments",
    es: 'Citas de hoy'
  },
  'dashboard.noData': {
    en: 'No data',
    es: 'Sin datos'
  },
  'dashboard.appointmentsCount': {
    en: 'appointments',
    es: 'citas'
  },
  'dashboard.revenue': {
    en: 'Revenue',
    es: 'Ingresos'
  },
  'dashboard.salesTrend': {
    en: 'Sales trend',
    es: 'Tendencia de ventas'
  },
  'dashboard.apptRevenue': {
    en: 'Appt revenue',
    es: 'Ingresos citas'
  },
  'dashboard.posSalesShort': {
    en: 'POS',
    es: 'POS'
  },
  'dashboard.noShowRate': {
    en: 'No-show rate',
    es: 'Tasa no-show'
  },
  'dashboard.noShowRateHint': {
    en: '{n} no-show of {total} appts',
    es: '{n} no-show de {total} citas'
  },
  'dashboard.noShowRateEmpty': {
    en: 'No appointments in period',
    es: 'Sin citas en el período'
  },
  'dashboard.inventoryCardTitle': {
    en: 'Inventory',
    es: 'Inventario'
  },
  'dashboard.inventoryOptimal': {
    en: 'Nothing is below your reorder point.',
    es: 'Nada por debajo del punto de reorden.'
  },
  'dashboard.inventorySubtitleLow': {
    en: '{n} at or below reorder',
    es: '{n} en o por debajo del mínimo'
  },
  'dashboard.inventorySubtitleOk': {
    en: 'All products at or above reorder',
    es: 'Todo el stock en o por encima del mínimo'
  },
  'dashboard.chartWeekly': {
    en: 'Weekly',
    es: 'Semanal'
  },
  'dashboard.chartMonthly': {
    en: 'Monthly',
    es: 'Mensual'
  },
  'dashboard.chartQuarterly': {
    en: 'Quarterly',
    es: 'Trimestral'
  },
  'dashboard.chartYearly': {
    en: 'Yearly',
    es: 'Anual'
  },
  'dashboard.chartCustom': {
    en: 'Custom',
    es: 'Personalizado'
  },
  'dashboard.customStart': {
    en: 'Start date',
    es: 'Fecha inicio'
  },
  'dashboard.customEnd': {
    en: 'End date',
    es: 'Fecha fin'
  },
  'dashboard.from': {
    en: 'From',
    es: 'Desde'
  },
  'dashboard.to': {
    en: 'To',
    es: 'Hasta'
  },
  'dashboard.apply': {
    en: 'Apply',
    es: 'Aplicar'
  },
  'dashboard.period': {
    en: 'Period',
    es: 'Período'
  },
  'dashboard.topSellingServices': {
    en: 'Top 3 selling services',
    es: 'Top 3 servicios vendidos'
  },
  'dashboard.uncategorizedService': {
    en: 'Other / unspecified',
    es: 'Otros / sin especificar'
  },
  'dashboard.noTopServicesData': {
    en: 'No service sales in this period yet. Record a paid transaction to see top services.',
    es: 'Aún no hay ventas de servicios en este período. Registra una transacción pagada para ver los servicios más vendidos.'
  },
  'dashboard.topServiceTooltipRevenueLine': {
    en: '{amount} from service lines',
    es: '{amount} en líneas de servicio'
  },
  'dashboard.topServiceShareOfRevenue': {
    en: '{pct}% of service revenue in this period',
    es: '{pct}% de ingresos por servicios en este período'
  },
  'dashboard.topServiceShareOfAllSales': {
    en: '{pct}% of all service sales this period',
    es: '{pct}% de todas las ventas de servicio en el período'
  },
  'dashboard.clientType': {
    en: 'Client type',
    es: 'Tipo de cliente'
  },
  'dashboard.newVsRepeatClients': {
    en: 'New vs repeat clients',
    es: 'Clientes nuevos vs recurrentes'
  },
  'dashboard.newClients': {
    en: 'New',
    es: 'Nuevos'
  },
  'dashboard.repeatClients': {
    en: 'Repeat',
    es: 'Recurrentes'
  },
  'dashboard.tooltipNewClientsFull': {
    en: '{n} new clients',
    es: '{n} clientes nuevos'
  },
  'dashboard.tooltipRepeatClientsFull': {
    en: '{n} repeat clients',
    es: '{n} clientes recurrentes'
  },
  'dashboard.servicesCompleted': {
    en: 'Billed services',
    es: 'Servicios facturados'
  },
  'diagnostics.demoUserShownAs': {
    en: 'Headers on /demo show “Demo User”. Your real profile in Supabase is unchanged.',
    es: 'Los encabezados en /demo muestran «Usuario demo». Tu perfil real en Supabase no cambia.',
  },
  'dashboard.quantity': {
    en: 'Quantity',
    es: 'Cantidad'
  },
  'dashboard.revenueLast30Days': {
    en: 'Revenue (30 d)',
    es: 'Ingresos (30 d)'
  },
  'dashboard.revenueFromTransactions': {
    en: 'From transactions',
    es: 'De transacciones'
  },
  'dashboard.totalEarned': {
    en: 'Total earned',
    es: 'Total ganado'
  },
  'dashboard.todaySales': {
    en: "Today's sales",
    es: 'Ventas de hoy'
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
  'dashboard.vsPreviousWeek': {
    en: 'vs previous week',
    es: 'vs semana anterior'
  },
  'dashboard.vsPrevious30Days': {
    en: 'vs previous 30 days',
    es: 'vs 30 días anteriores'
  },
  'dashboard.vsPrevious90Days': {
    en: 'vs previous 90 days',
    es: 'vs 90 días anteriores'
  },
  'dashboard.vsPreviousYear': {
    en: 'vs previous year',
    es: 'vs año anterior'
  },
  'dashboard.vsPreviousPeriod': {
    en: 'vs previous period',
    es: 'vs período anterior'
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
  'dashboard.lowStockTitle': {
    en: 'Low in stock',
    es: 'Poco stock'
  },
  'dashboard.lowStockSubtitle': {
    en: 'At or below reorder level',
    es: 'En o bajo el nivel de pedido'
  },
  'dashboard.lowStockEmpty': {
    en: 'All products are above your reorder levels.',
    es: 'Todos los productos están por encima del nivel de pedido.'
  },
  'dashboard.openInventory': {
    en: 'Open inventory',
    es: 'Abrir inventario'
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
  'inventory.scanBarcodeDescription': {
    en: 'Use your camera to scan a barcode, or enter SKU/barcode manually below.',
    es: 'Usa la cámara para escanear un código de barras, o ingresa el SKU/código manualmente.'
  },
  'inventory.cameraStarting': {
    en: 'Starting camera…',
    es: 'Iniciando cámara…'
  },
  'inventory.cameraPermissionDenied': {
    en: 'Camera access denied. Please allow camera access to scan barcodes.',
    es: 'Acceso a la cámara denegado. Permite el acceso para escanear códigos.'
  },
  'inventory.noCameraAvailable': {
    en: 'No camera found.',
    es: 'No se encontró cámara.'
  },
  'inventory.switchToFrontCamera': {
    en: 'Front camera',
    es: 'Cámara frontal'
  },
  'inventory.switchToBackCamera': {
    en: 'Back camera',
    es: 'Cámara trasera'
  },
  'inventory.manualBarcodeEntry': {
    en: 'Or enter barcode / SKU',
    es: 'O ingresa código de barras / SKU'
  },
  'inventory.manualEntryLabel': {
    en: 'Or enter barcode / SKU manually',
    es: 'O ingresa código de barras / SKU manualmente'
  },
  'inventory.manualEntryHint': {
    en: 'Barcode: the number under the lines on the product (e.g. UPC). SKU: your own internal code (e.g. DS-001).',
    es: 'Código de barras: el número bajo las líneas del producto. SKU: tu código interno (ej. DS-001).'
  },
  'inventory.manualEntryPlaceholder': {
    en: 'Barcode or SKU',
    es: 'Código de barras o SKU'
  },
  'inventory.skuHelp': {
    en: 'Your internal code (e.g. DS-001 or PET-001). Required and unique. Use any format; leave barcode blank for items without a barcode.',
    es: 'Tu código interno (ej. DS-001 o PET-001). Obligatorio y único. Cualquier formato; deja el código de barras en blanco si no tiene.'
  },
  'inventory.barcodeHelp': {
    en: 'UPC/EAN (number under the barcode). Optional—leave blank for custom items and use your own SKU above.',
    es: 'UPC/EAN (número bajo el código de barras). Opcional—deja en blanco para productos sin código.'
  },
  'inventory.adjustQuantity': {
    en: 'Adjust quantity',
    es: 'Ajustar cantidad'
  },
  'inventory.addQuantity': {
    en: 'Add to stock',
    es: 'Agregar al inventario'
  },
  'inventory.productAddedFromBarcode': {
    en: 'Product added from barcode',
    es: 'Producto agregado desde código de barras'
  },
  'inventory.lookingUpBarcode': {
    en: 'Looking up product…',
    es: 'Buscando producto…'
  },
  'inventory.barcodeLookupNotConfigured': {
    en: 'Barcode lookup is not set up. Add BARCODE_LOOKUP_API_KEY in Supabase secrets (see docs).',
    es: 'La búsqueda por código no está configurada. Añade BARCODE_LOOKUP_API_KEY en secretos de Supabase.'
  },
  'inventory.barcodeNotFoundInDatabase': {
    en: 'Product not found in barcode database. Enter details manually.',
    es: 'Producto no encontrado en la base de códigos. Ingresa los datos manualmente.'
  },
  'inventory.barcodeFoundPrefill': {
    en: 'Product found. Confirm details and save.',
    es: 'Producto encontrado. Confirma los datos y guarda.'
  },
  'inventory.barcodeLookupFailed': {
    en: 'Lookup failed. Enter product details manually.',
    es: 'La búsqueda falló. Ingresa los datos del producto manualmente.'
  },
  'inventory.addStockShort': {
    en: 'Add',
    es: 'Sumar'
  },
  'inventory.addMoreStock': {
    en: 'Add more to stock',
    es: 'Agregar más al inventario'
  },
  'inventory.addHowMany': {
    en: 'How many to add?',
    es: '¿Cuántos agregar?'
  },
  'inventory.setQuantityTo': {
    en: 'Set quantity to',
    es: 'Establecer cantidad a'
  },
  'inventory.inventoryCount': {
    en: 'Inventory count',
    es: 'Conteo de inventario'
  },
  'inventory.quantityToAddOrRemove': {
    en: 'Quantity to add or remove (negative = sale)',
    es: 'Cantidad a sumar o restar (negativo = venta)'
  },
  'inventory.addOrRemove': {
    en: 'Add or remove',
    es: 'Sumar o restar'
  },
  'inventory.done': {
    en: 'Done',
    es: 'Listo'
  },
  'inventory.barcodeTypeHint': {
    en: 'Type the number under the barcode lines on the product.',
    es: 'Escribe el número bajo las líneas del código de barras del producto.'
  },
  'inventory.barcodePlaceholder': {
    en: 'e.g. 012345678905',
    es: 'ej. 012345678905'
  },
  'inventory.enterBarcode': {
    en: 'Enter barcode',
    es: 'Ingresar código'
  },
  'inventory.scanHistory': {
    en: 'Scan history',
    es: 'Historial de escaneos'
  },
  'inventory.editProduct': {
    en: 'Edit Product',
    es: 'Editar Producto'
  },
  'inventory.editProductDescription': {
    en: 'Update details, stock, and pricing for this product.',
    es: 'Actualiza detalles, inventario y precios de este producto.'
  },
  'inventory.uploadPhoto': {
    en: 'Upload or change photo',
    es: 'Subir o cambiar foto'
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
    en: 'Add staff member',
    es: 'Agregar miembro del personal'
  },
  'employeeManagement.editEmployee': {
    en: 'Edit staff member',
    es: 'Editar miembro del personal'
  },
  'employeeManagement.addNewEmployee': {
    en: 'Add new staff member',
    es: 'Agregar nuevo miembro del personal'
  },
  'employeeManagement.searchPlaceholder': {
    en: 'Search staff by name, email, phone, or job title...',
    es: 'Buscar personal por nombre, correo, teléfono o puesto...',
  },
  'employeeManagement.noSearchResults': {
    en: 'No staff match your search.',
    es: 'Ningún miembro del personal coincide con tu búsqueda.',
  },
  'employeeManagement.invitePortalShort': {
    en: 'Invite',
    es: 'Invitar',
  },
  'employeeManagement.sendPortalInvite': {
    en: 'Send employee portal invitation',
    es: 'Enviar invitación al portal',
  },
  'employeeManagement.invitationPending': {
    en: 'Invitation pending',
    es: 'Invitación pendiente',
  },
  'employeeManagement.accountActive': {
    en: 'Account active',
    es: 'Cuenta activa',
  },
  'employeeInvite.dialogTitle': {
    en: 'Send employee portal invitation',
    es: 'Enviar invitación al portal',
  },
  'employeeInvite.dialogDescriptionLead': {
    en: 'Invite ',
    es: 'Invitar a ',
  },
  'employeeInvite.dialogDescriptionTrail': {
    en: ' to create their employee account.',
    es: ' a crear su cuenta de empleado.',
  },
  'employeeInvite.dialogSelectStaff': {
    en: 'Select a staff member.',
    es: 'Selecciona un miembro del personal.',
  },
  'employeeInvite.emailLabel': {
    en: 'Email',
    es: 'Correo electrónico',
  },
  'employeeInvite.emailPlaceholder': {
    en: 'you@example.com',
    es: 'correo@ejemplo.com',
  },
  'employeeInvite.send': {
    en: 'Send invitation',
    es: 'Enviar invitación',
  },
  'employeeInvite.sending': {
    en: 'Sending…',
    es: 'Enviando…',
  },
  'employeeInvite.successSent': {
    en: 'Invitation sent to {email}',
    es: 'Invitación enviada a {email}',
  },
  'employeeInvite.errorMissingContext': {
    en: 'Missing business or staff information.',
    es: 'Falta información del negocio o del empleado.',
  },
  'employeeInvite.errorMissingEmail': {
    en: 'Add an email address for the invitation.',
    es: 'Agrega un correo electrónico para la invitación.',
  },
  'employeeInvite.errorSession': {
    en: 'Session expired. Please sign in again.',
    es: 'Sesión expirada. Vuelve a iniciar sesión.',
  },
  'employeeInvite.superAdminMissingBusiness': {
    en: 'Business context is missing in this view.',
    es: 'Falta business_id en este contexto.',
  },
  'employeeInvite.errorGeneric': {
    en: 'Something went wrong while sending.',
    es: 'Error al enviar.',
  },
  'employeeInvite.errorSendFailed': {
    en: 'Could not send the invitation.',
    es: 'No se pudo enviar la invitación.',
  },
  'employeeInvite.errorTimeout': {
    en: 'Sending took too long (timed out). Check Supabase Edge Function logs for send-employee-invitation, confirm RESEND_API_KEY is set, and that api.resend.com is reachable.',
    es: 'El envío tardó demasiado (tiempo agotado). Revisa los logs de la Edge Function send-employee-invitation en Supabase, confirma que RESEND_API_KEY esté configurada y que api.resend.com sea accesible.',
  },
  'employeeManagement.noEmployeesYet': {
    en: 'No staff yet. Add your first team member above!',
    es: 'Aún no hay personal. ¡Agrega a tu primer miembro del equipo arriba!'
  },
  'employeeManagement.deleteEmployee': {
    en: 'End employment',
    es: 'Finalizar empleo'
  },
  'employeeManagement.reactivateEmployee': {
    en: 'Reactivate employee',
    es: 'Reactivar empleado'
  },
  'employeeManagement.firstName': {
    en: 'First name',
    es: 'Nombre'
  },
  'employeeManagement.lastName': {
    en: 'Last name',
    es: 'Apellido'
  },
  'employeeManagement.firstNameRequired': {
    en: 'First name is required.',
    es: 'El nombre es obligatorio.'
  },
  'employeeManagement.jobTitleRequired': {
    en: 'Select a job title or add a new one.',
    es: 'Selecciona un puesto o agrega uno nuevo.'
  },
  'employeeManagement.jobTitleDuplicate': {
    en: 'That job title already exists (titles are unique regardless of capitalization).',
    es: 'Ese puesto ya existe (los puestos son únicos sin importar mayúsculas).'
  },
  'employeeManagement.selectJobTitle': {
    en: 'Select job title',
    es: 'Seleccionar puesto'
  },
  'employeeManagement.noJobTitlesYet': {
    en: 'No job titles yet. Add one to assign roles.',
    es: 'Aún no hay puestos. Agrega uno para asignar roles.'
  },
  'employeeManagement.jobTitlesSchemaErrorShort': {
    en: 'Job titles table is missing on the server (migrations not applied or API schema cache stale).',
    es: 'Falta la tabla de puestos en el servidor (migraciones sin aplicar o caché del API desactualizada).'
  },
  'employeeManagement.jobTitlesSchemaAlertTitle': {
    en: 'Job titles are not available from the API yet',
    es: 'Los puestos aún no están disponibles desde el API'
  },
  'employeeManagement.jobTitlesSchemaAlertBody1': {
    en: 'Your database needs the staff_job_titles table and related changes. From your project folder run:',
    es: 'Tu base de datos necesita la tabla staff_job_titles y los cambios relacionados. Desde la carpeta del proyecto ejecuta:'
  },
  'employeeManagement.jobTitlesSchemaAlertCodePush': {
    en: 'npx supabase link && npx supabase db push',
    es: 'npx supabase link && npx supabase db push'
  },
  'employeeManagement.jobTitlesSchemaAlertBody2': {
    en: 'Or paste the SQL from supabase/migrations/20260404180000_staff_names_and_job_titles.sql and 20260404190000_sync_staff_job_titles_from_roles.sql into Supabase Dashboard → SQL (in that order).',
    es: 'O pega el SQL de supabase/migrations/20260404180000_staff_names_and_job_titles.sql y luego 20260404190000_sync_staff_job_titles_from_roles.sql en Supabase → SQL (en ese orden).'
  },
  'employeeManagement.jobTitlesSchemaAlertBody3': {
    en: 'If the table already exists but you still see this error, run NOTIFY pgrst, \'reload schema\'; (see supabase/manual_reload_postgrest_schema.sql).',
    es: 'Si la tabla ya existe y sigue el error, ejecuta NOTIFY pgrst, \'reload schema\'; (ver supabase/manual_reload_postgrest_schema.sql).'
  },
  'employeeManagement.jobTitleEmpty': {
    en: 'Enter a job title.',
    es: 'Escribe un puesto.'
  },
  'employeeManagement.jobTitle': {
    en: 'Job title',
    es: 'Puesto'
  },
  'employeeManagement.addJobTitle': {
    en: 'Add job title',
    es: 'Agregar puesto'
  },
  'employeeManagement.newJobTitlePlaceholder': {
    en: 'New job title (e.g. Assistant Manager)',
    es: 'Nuevo puesto (ej. Asistente de gerente)'
  },
  'employeeManagement.manageJobTitles': {
    en: 'Manage job titles',
    es: 'Administrar puestos'
  },
  'employeeManagement.removeJobTitle': {
    en: 'Remove',
    es: 'Eliminar'
  },
  'employeeManagement.deleteConfirm': {
    en: 'They will be moved to Inactive and kept on file — not permanently deleted.',
    es: 'Pasarán a Inactivos y se conservarán en el sistema; no se borran del todo.'
  },
  'employeeManagement.removeEmployeeDialogTitle': {
    en: 'End employment',
    es: 'Finalizar empleo'
  },
  'employeeManagement.removeEmployeeDialogIntro': {
    en: 'Staff are never permanently deleted. Enter their last working day; they will be moved to Inactive and remain in your records.',
    es: 'El personal no se elimina por completo. Indica el último día laboral; pasará a Inactivo y seguirá en tus registros.'
  },
  'employeeManagement.removeLastWorkingDateLabel': {
    en: 'Last working day',
    es: 'Último día laboral'
  },
  'employeeManagement.removeFutureInactiveWarning': {
    en: 'That date is still in the future. They will be moved to Inactive now and stay listed there until after that day. They should not be treated as active staff in the meantime.',
    es: 'Esa fecha aún no ha pasado. La persona pasará a Inactiva ahora y seguirá en esa lista hasta después de ese día. No debe tratarse como personal activo mientras tanto.'
  },
  'employeeManagement.removePastInactiveNote': {
    en: 'Last working day is today or in the past: they are moved to Inactive immediately and stay in the Inactive list with this date saved.',
    es: 'Si el último día es hoy o ya pasó: pasan a Inactivos de inmediato y permanecen en esa lista con esta fecha guardada.'
  },
  'employeeManagement.removeNoPermanentDeletionNote': {
    en: 'Nothing is permanently removed. Use the Inactive filter to see former staff, payroll history, and details.',
    es: 'Nada se borra del todo. Usa el filtro Inactivos para ver ex personal, historial y datos.'
  },
  'employeeManagement.removeConfirmAction': {
    en: 'Move to inactive',
    es: 'Pasar a inactivo'
  },
  'employeeManagement.reactivateEmployeeDialogTitle': {
    en: 'Reactivate employee',
    es: 'Reactivar empleado'
  },
  'employeeManagement.reactivateEmployeeDialogIntro': {
    en: 'Enter their new start date. They will be moved back to Active and their last working day will be cleared.',
    es: 'Indica su nueva fecha de inicio. Se moverá a Activo y se borrará su último día laboral.'
  },
  'employeeManagement.reactivateStartDateLabel': {
    en: 'New start date',
    es: 'Nueva fecha de inicio'
  },
  'employeeManagement.reactivateConfirmAction': {
    en: 'Reactivate',
    es: 'Reactivar'
  },
  'employeeManagement.pinLabel': {
    en: '4-digit PIN',
    es: 'PIN de 4 dígitos'
  },
  'employeeManagement.generatePin': {
    en: 'Generate PIN',
    es: 'Generar PIN'
  },
  'employeeManagement.pinMissingError': {
    en: 'Could not assign a PIN. Try generating again.',
    es: 'No se pudo asignar un PIN. Intenta generar de nuevo.'
  },
  'employeeManagement.dateOfBirthLabel': {
    en: 'Date of birth',
    es: 'Fecha de nacimiento'
  },
  'employeeManagement.dobDay': {
    en: 'Day',
    es: 'Día'
  },
  'employeeManagement.dobMonth': {
    en: 'Month',
    es: 'Mes'
  },
  'employeeManagement.dobYear': {
    en: 'Year',
    es: 'Año'
  },
  'employeeManagement.dobPlaceholder': {
    en: 'Select…',
    es: 'Elegir…'
  },
  'employeeManagement.dobIncomplete': {
    en: 'Please complete day, month, and year for date of birth, or clear all three fields.',
    es: 'Completa día, mes y año de nacimiento, o deja los tres vacíos.'
  },
  'employeeManagement.dobInvalid': {
    en: 'That date of birth is not valid for the calendar (check month length and leap years).',
    es: 'Esa fecha de nacimiento no es válida (revisa días del mes y años bisiestos).'
  },
  'employeeManagement.dobClear': {
    en: 'Clear date of birth',
    es: 'Borrar fecha de nacimiento'
  },
  'employeeManagement.saveStaffFailed': {
    en: 'Could not save this staff member. Check your connection and that Supabase allows updating staff (including birth date columns).',
    es: 'No se pudo guardar. Revisa la conexión y los permisos en Supabase.',
  },
  'employeeManagement.statusFilter': {
    en: 'Show',
    es: 'Mostrar'
  },
  'employeeManagement.filterActive': {
    en: 'Active employees',
    es: 'Empleados activos'
  },
  'employeeManagement.filterInactive': {
    en: 'Inactive employees',
    es: 'Empleados inactivos'
  },
  'employeeManagement.showDetails': {
    en: 'Show details',
    es: 'Ver detalles'
  },
  'employeeManagement.hideDetails': {
    en: 'Hide details',
    es: 'Ocultar detalles'
  },
  'employeeManagement.detailsHint': {
    en: 'Open details for date of birth, PIN, and actions',
    es: 'Abre los detalles para fecha de nacimiento, PIN y acciones'
  },
  'employeeManagement.hiredOn': {
    en: 'Hired on {date}',
    es: 'Contratación: {date}'
  },
  'employeeManagement.tenureToDate': {
    en: 'Tenure: {tenure}',
    es: 'Antigüedad: {tenure}'
  },
  'employeeManagement.lastWorkingDay': {
    en: 'Last working day: {date}',
    es: 'Último día laboral: {date}'
  },
  'employeeManagement.timeWithCompany': {
    en: 'Time with company: {tenure}',
    es: 'Tiempo en la empresa: {tenure}'
  },
  'employeeManagement.accessRoleLabel': {
    en: 'Access role',
    es: 'Rol de acceso'
  },
  'employeeManagement.accessRoleHint': {
    en: 'Who can open manager-only screens (separate from job title above).',
    es: 'Quién puede abrir pantallas solo para gerentes (aparte del puesto de arriba).'
  },
  'employeeManagement.accessRoleManager': {
    en: 'Manager',
    es: 'Gerente'
  },
  'employeeManagement.accessRoleStaff': {
    en: 'Staff',
    es: 'Equipo'
  },
  'employeeManagement.accessRoleAdmin': {
    en: 'Admin',
    es: 'Administrador'
  },
  'employeeManagement.accessRoleContractor': {
    en: 'Contractor',
    es: 'Contratista'
  },
  'employeeManagement.lastManagerGuard': {
    en: 'You cannot remove the only manager’s access for this business. Promote another manager first.',
    es: 'No puede quitar el acceso de gerente al único gerente. Promueva a otro gerente primero.'
  },
  'employeeManagement.lastAdminGuard': {
    en: 'You cannot remove the only administrator for this business. Assign another admin first.',
    es: 'No puede quitar al único administrador. Asigne otro administrador primero.'
  },
  'employeeManagement.accessRoleManagersCannotAssignAdmin': {
    en: 'Only an administrator can assign the admin access role.',
    es: 'Solo un administrador puede asignar el rol de acceso administrador.'
  },
  'employeeManagement.accessRoleReadOnlyHint': {
    en: 'Only administrators and managers can change access roles.',
    es: 'Solo administradores y gerentes pueden cambiar los roles de acceso.'
  },
  'employeeManagement.accessRoleCurrentAdmin': {
    en: 'Administrator (current)',
    es: 'Administrador (actual)'
  },
  'employeeManagement.fieldHireDate': {
    en: 'Hire date',
    es: 'Fecha de contratación'
  },
  'employeeManagement.fieldStatus': {
    en: 'Status',
    es: 'Estado'
  },
  'employeeManagement.statusActiveShort': {
    en: 'Active',
    es: 'Activo'
  },
  'employeeManagement.statusInactiveShort': {
    en: 'Inactive',
    es: 'Inactivo'
  },
  'employeeManagement.lastDateFieldLabel': {
    en: 'Last date (end of employment)',
    es: 'Último día laboral'
  },
  'employeeManagement.hireDateMissing': {
    en: 'Hire date not set',
    es: 'Sin fecha de contratación'
  },
  'employeeManagement.lastDateMissing': {
    en: 'Last day not set',
    es: 'Sin fecha de salida'
  },
  'employeeManagement.emailActivationWarning': {
    en: 'No email on file. Every team member needs an email to activate their login and receive account invites. You can add one later.',
    es: 'Sin correo electrónico. Cada miembro del equipo necesita un correo para activar su acceso e invitaciones. Puedes agregarlo después.'
  },
  'employeeManagement.emailOptionalHint': {
    en: 'Recommended for invites and login activation.',
    es: 'Recomendado para invitaciones y activación de acceso.'
  },
  'employeeManagement.profilePhoto': {
    en: 'Profile photo',
    es: 'Foto de perfil'
  },
  'employeeManagement.profilePhotoHint': {
    en: 'JPEG, PNG, WebP or GIF, up to 5 MB (same as pet photos).',
    es: 'JPEG, PNG, WebP o GIF, hasta 5 MB (igual que fotos de mascotas).'
  },
  'employeeManagement.removePhoto': {
    en: 'Remove photo',
    es: 'Quitar foto'
  },
  'employeeManagement.compensationType': {
    en: 'Compensation',
    es: 'Compensación'
  },
  'employeeManagement.compensationHourly': {
    en: 'Hourly',
    es: 'Por hora'
  },
  'employeeManagement.compensationCommission': {
    en: 'Commission',
    es: 'Comisión'
  },
  'employeeManagement.commissionRate': {
    en: 'Commission rate (% of sales)',
    es: 'Porcentaje de comisión (% de ventas)'
  },
  'employeeManagement.servicesOfferedTitle': {
    en: 'Services offered',
    es: 'Servicios que ofrece'
  },
  'employeeManagement.addServicesButton': {
    en: 'Add services',
    es: 'Agregar servicios'
  },
  'employeeManagement.addServicesDialogTitle': {
    en: 'Add services',
    es: 'Agregar servicios'
  },
  'employeeManagement.servicesOfferedHint': {
    en: 'Choose the services you perform. Leave none selected to show as available for any service when assigning appointments.',
    es: 'Elige los servicios que realizas. Si no marcas ninguno, aparecerás disponible para cualquier servicio al asignar citas.',
  },
  'employeeManagement.servicesOfferedEmptyRead': {
    en: 'No specific services selected (available for any service when assigning).',
    es: 'Sin servicios específicos (disponible para cualquier servicio al asignar).',
  },
  'employeeManagement.servicesOfferedNoCatalog': {
    en: 'No active services in this business yet. Managers can add services under business settings.',
    es: 'Aún no hay servicios activos. Los gerentes pueden agregarlos en la configuración del negocio.',
  },
  'employeeManagement.paymentSection': {
    en: 'Bank Information',
    es: 'Información bancaria'
  },
  'employeeManagement.bankName': {
    en: 'Bank name',
    es: 'Nombre del banco'
  },
  'employeeManagement.routingNumber': {
    en: 'Routing (ABA) number',
    es: 'Número de ruta (ABA)'
  },
  'employeeManagement.routingCustom': {
    en: 'Custom (enter routing below)',
    es: 'Personalizado (ingrese la ruta abajo)'
  },
  'employeeManagement.routingNumberManual': {
    en: 'Routing number (9 digits)',
    es: 'Número de ruta (9 dígitos)'
  },
  'employeeManagement.routingMatched': {
    en: 'Matched bank',
    es: 'Banco detectado'
  },
  'employeeManagement.accountNumber': {
    en: 'Account number',
    es: 'Número de cuenta'
  },
  'employeeManagement.paymentNotes': {
    en: 'Payment notes',
    es: 'Notas de pago'
  },
  'employeeManagement.routingInvalid': {
    en: 'Routing number must be 9 digits (or leave blank).',
    es: 'El número de ruta debe tener 9 dígitos (o déjelo vacío).'
  },
  'employeeManagement.noInactiveEmployees': {
    en: 'No inactive employees.',
    es: 'No hay empleados inactivos.'
  },
  'employeeManagement.noActiveEmployees': {
    en: 'No active employees.',
    es: 'No hay empleados activos.'
  },
  'birthdayModal.title': {
    en: '🎉 Happy Birthday, {name}! 🎉',
    es: '🎉 ¡Feliz cumpleaños, {name}! 🎉'
  },
  'birthdayModal.body': {
    en: 'Wishing you a wonderful year ahead filled with joy, success, and amazing moments!',
    es: 'Te deseamos un año maravilloso lleno de alegría, éxitos y momentos increíbles.'
  },
  'birthdayModal.fromTeam': {
    en: 'From your team at {company}',
    es: 'De tu equipo en {company}'
  },
  'birthdayModal.celebrateAgain': {
    en: 'Celebrate again',
    es: 'Celebrar de nuevo'
  },
  'employeePinSetup.title': {
    en: 'Set clock PIN',
    es: 'Configurar PIN del reloj'
  },
  'employeePinSetup.description': {
    en: '{name}, use the generated PIN below for clocking in and out. You can generate a new code before saving.',
    es: '{name}, usa el PIN generado abajo para fichar. Puedes generar otro antes de guardar.'
  },
  'employeePinSetup.generateAnother': {
    en: 'Generate new PIN',
    es: 'Generar otro PIN'
  },
  'employeePinSetup.savePin': {
    en: 'Save PIN',
    es: 'Guardar PIN'
  },
  'employeePinSetup.saving': {
    en: 'Saving…',
    es: 'Guardando…'
  },
  'employeePinSetup.generateFailed': {
    en: 'Could not generate a PIN. Try again.',
    es: 'No se pudo generar un PIN. Intenta de nuevo.'
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
  'form.firstName': {
    en: 'First Name',
    es: 'Nombre'
  },
  'form.lastName': {
    en: 'Last Name',
    es: 'Apellido'
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
  'form.city': {
    en: 'City',
    es: 'Ciudad'
  },
  'form.state': {
    en: 'State',
    es: 'Estado'
  },
  'form.zipCode': {
    en: 'ZIP Code',
    es: 'Código Postal'
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
  'form.searchClient': {
    en: 'Search client',
    es: 'Buscar cliente'
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
  'appointments.deleteAppointmentTitle': {
    en: 'Delete Appointment',
    es: 'Eliminar Cita'
  },
  'appointments.deleteAppointmentDescription': {
    en: 'Are you sure you want to delete this appointment? This action cannot be undone.',
    es: '¿Estás seguro de que deseas eliminar esta cita? Esta acción no se puede deshacer.'
  },
  'appointments.appointmentDeleted': {
    en: 'Appointment deleted successfully',
    es: 'Cita eliminada exitosamente'
  },
  'appointments.markNoShow': {
    en: 'No-Show',
    es: 'No-Show'
  },
  'appointments.noShowConfirm': {
    en: 'Confirm',
    es: 'Confirmar'
  },
  'appointments.markedNoShow': {
    en: 'Marked as no-show',
    es: 'Marcado como no-show'
  },
  'appointments.noShowFailed': {
    en: 'Could not update appointment',
    es: 'No se pudo actualizar la cita'
  },
  'appointments.statusNoShow': {
    en: 'No-Show',
    es: 'No-Show'
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
  'schedule.managerTitle': {
    en: 'Employee Schedule',
    es: 'Horario de Empleados'
  },
  'schedule.managerDescription': {
    en: 'Drag employees onto the calendar to assign shifts. Click a shift to edit or remove.',
    es: 'Arrastre empleados al calendario para asignar turnos. Haga clic en un turno para editar o eliminar.'
  },
  'schedule.today': {
    en: 'Today',
    es: 'Hoy'
  },
  'schedule.dragEmployees': {
    en: 'Drag to schedule',
    es: 'Arrastrar para programar'
  },
  'schedule.editShift': {
    en: 'Edit Shift',
    es: 'Editar Turno'
  },
  'schedule.addShift': {
    en: 'Add Shift',
    es: 'Agregar Turno'
  },
  'schedule.tableTitle': {
    en: 'Schedule by employee',
    es: 'Horario por empleado'
  },
  'schedule.tableDescription': {
    en: 'Click a cell to add or edit the shift for that day.',
    es: 'Haga clic en una celda para agregar o editar el turno de ese día.'
  },
  'schedule.clickToAdd': {
    en: 'Click to add shift',
    es: 'Clic para agregar turno'
  },
  'schedule.startTime': {
    en: 'Start time',
    es: 'Hora de inicio'
  },
  'schedule.endTime': {
    en: 'End time',
    es: 'Hora de fin'
  },
  'schedule.notes': {
    en: 'Notes',
    es: 'Notas'
  },
  'schedule.notesPlaceholder': {
    en: 'Optional notes',
    es: 'Notas opcionales'
  },
  'schedule.deleteShift': {
    en: 'Delete shift',
    es: 'Eliminar turno'
  },
  'schedule.confirmDeleteShift': {
    en: 'Delete this shift?',
    es: '¿Eliminar este turno?'
  },
  'schedule.weeklySummary': {
    en: 'Weekly hours (scheduled)',
    es: 'Horas semanales (programadas)'
  },
  'schedule.myScheduleTitle': {
    en: 'My Schedule',
    es: 'Mi Horario'
  },
  'schedule.myScheduleDescription': {
    en: 'Your assigned shifts for the week',
    es: 'Tus turnos asignados para la semana'
  },
  'schedule.yourShifts': {
    en: 'Your shifts',
    es: 'Tus turnos'
  },
  'schedule.noShiftsScheduled': {
    en: 'No shifts scheduled for this week.',
    es: 'No hay turnos programados para esta semana.'
  },
  'schedule.invalidTimeFormat': {
    en: 'Please enter valid start and end times (e.g. 09:00, 14:00).',
    es: 'Ingrese horas de inicio y fin válidas (ej. 09:00, 14:00).'
  },
  'schedule.endMustBeAfterStart': {
    en: 'End time must be after start time.',
    es: 'La hora de fin debe ser posterior a la hora de inicio.'
  },
  'schedule.outsideBusinessHours': {
    en: 'This shift is outside business hours. Adjust the times or update business hours in Settings.',
    es: 'Este turno está fuera del horario comercial. Ajuste las horas o actualice el horario en Configuración.'
  },
  'schedule.resizeEndTime': {
    en: 'Drag to change end time',
    es: 'Arrastrar para cambiar hora de fin'
  },
  'schedule.sameEmployeeOverlap': {
    en: 'This employee already has a shift at this time. Choose a different time or day.',
    es: 'Este empleado ya tiene un turno en este horario. Elija otro horario o día.'
  },
  'schedule.copyFromLastWeek': {
    en: 'Copy schedule from last week',
    es: 'Copiar horario de la semana pasada'
  },
  'schedule.print': {
    en: 'Print',
    es: 'Imprimir'
  },
  'schedule.printWeekRange': {
    en: 'Week of {start} – {end}',
    es: 'Semana del {start} – {end}'
  },
  'schedule.myScheduleNoStaffLink': {
    en: 'Your account is not linked to a staff profile yet. Ask a manager to connect your login to your staff record.',
    es: 'Tu cuenta aún no está vinculada a un perfil de personal. Pídele a un administrador que conecte tu acceso a tu registro de personal.'
  },
  'nav.shiftChangeRequests': {
    en: 'Shift requests',
    es: 'Solicitudes de horario'
  },
  'schedule.shiftRequest.openButton': {
    en: 'Request change',
    es: 'Solicitar cambio'
  },
  'schedule.shiftRequest.sectionTitle': {
    en: 'Schedule change requests',
    es: 'Solicitudes de cambio de horario'
  },
  'schedule.shiftRequest.title': {
    en: 'Request a schedule change',
    es: 'Solicitar un cambio de horario'
  },
  'schedule.shiftRequest.kind': {
    en: 'Request type',
    es: 'Tipo de solicitud'
  },
  'schedule.shiftRequest.kindNew': {
    en: 'New shift',
    es: 'Nuevo turno'
  },
  'schedule.shiftRequest.kindChange': {
    en: 'Change shift',
    es: 'Cambiar turno'
  },
  'schedule.shiftRequest.kindCancel': {
    en: 'Cancel shift',
    es: 'Cancelar turno'
  },
  'schedule.shiftRequest.pickShift': {
    en: 'Select shift',
    es: 'Seleccionar turno'
  },
  'schedule.shiftRequest.was': {
    en: 'Current:',
    es: 'Actual:'
  },
  'schedule.shiftRequest.reason': {
    en: 'Reason',
    es: 'Motivo'
  },
  'schedule.shiftRequest.reasonPlaceholder': {
    en: 'Explain what you need…',
    es: 'Explica lo que necesitas…'
  },
  'schedule.shiftRequest.submit': {
    en: 'Submit request',
    es: 'Enviar solicitud'
  },
  'schedule.shiftRequest.myRequests': {
    en: 'Your requests',
    es: 'Tus solicitudes'
  },
  'schedule.shiftRequest.noRequests': {
    en: 'No requests yet.',
    es: 'Aún no hay solicitudes.'
  },
  'schedule.shiftRequest.cancelRequest': {
    en: 'Cancel request',
    es: 'Cancelar solicitud'
  },
  'schedule.shiftRequest.statusPending': {
    en: 'Pending',
    es: 'Pendiente'
  },
  'schedule.shiftRequest.statusApproved': {
    en: 'Approved',
    es: 'Aprobada'
  },
  'schedule.shiftRequest.statusRejected': {
    en: 'Rejected',
    es: 'Rechazada'
  },
  'schedule.shiftRequest.statusCancelled': {
    en: 'Cancelled',
    es: 'Cancelada'
  },
  'schedule.shiftRequest.tabPending': {
    en: 'Pending',
    es: 'Pendientes'
  },
  'schedule.shiftRequest.tabHistory': {
    en: 'History',
    es: 'Historial'
  },
  'schedule.shiftRequest.noPending': {
    en: 'You have no pending requests.',
    es: 'No tienes solicitudes pendientes.'
  },
  'schedule.shiftRequest.noHistory': {
    en: 'No past requests yet.',
    es: 'Aún no hay solicitudes anteriores.'
  },
  'schedule.shiftRequest.submittedAt': {
    en: 'Submitted',
    es: 'Enviada'
  },
  'schedule.shiftRequest.reviewedAt': {
    en: 'Reviewed',
    es: 'Revisada'
  },
  'schedule.shiftApproval.empty': {
    en: 'No pending shift requests.',
    es: 'No hay solicitudes de horario pendientes.'
  },
  'schedule.shiftApproval.pending': {
    en: 'Pending',
    es: 'Pendiente'
  },
  'schedule.shiftApproval.kind': {
    en: 'Type',
    es: 'Tipo'
  },
  'schedule.shiftApproval.previousShift': {
    en: 'Current shift',
    es: 'Turno actual'
  },
  'schedule.shiftApproval.proposed': {
    en: 'Proposed',
    es: 'Propuesto'
  },
  'schedule.shiftApproval.reviewNotes': {
    en: 'Review notes (optional)',
    es: 'Notas de revisión (opcional)'
  },
  'schedule.shiftApproval.reject': {
    en: 'Reject',
    es: 'Rechazar'
  },
  'schedule.shiftApproval.approve': {
    en: 'Approve',
    es: 'Aprobar'
  },
  'schedule.shiftApproval.backToSchedule': {
    en: 'Back to schedule',
    es: 'Volver al horario'
  },

  // Payroll page
  'payroll.title': {
    en: 'Timesheets',
    es: 'Hojas de horas'
  },
  'payroll.description': {
    en: 'Review hours, edit clock times, and run pay calculations for each period.',
    es: 'Revise horas, edite fichajes y calcule pagos por período.'
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
  'payroll.employeeSummary': {
    en: 'Staff summary',
    es: 'Resumen del personal'
  },
  'payroll.employeeSummaryDescription': {
    en: 'Choose one or more staff members to view their shifts. Click a row or the pencil to edit clock in and out.',
    es: 'Elija uno o más miembros del personal para ver sus turnos. Pulse una fila o el lápiz para editar entrada y salida.'
  },
  'payroll.filterEmployees': {
    en: 'Staff filter',
    es: 'Filtrar personal'
  },
  'payroll.selectEmployees': {
    en: 'Select staff',
    es: 'Seleccionar personal'
  },
  'payroll.employeesSelected': {
    en: '{count} selected',
    es: '{count} seleccionados'
  },
  'payroll.selectAllStaff': {
    en: 'Select all',
    es: 'Seleccionar todos'
  },
  'payroll.clearStaffSelection': {
    en: 'Clear',
    es: 'Limpiar'
  },
  'payroll.selectStaffToView': {
    en: 'Select one or more staff members to view their time entries for this pay period.',
    es: 'Seleccione uno o más miembros del personal para ver sus entradas de tiempo en este período.'
  },
  'payroll.noEntriesThisPeriod': {
    en: 'No time entries in this pay period.',
    es: 'No hay entradas de tiempo en este período.'
  },
  'payroll.noVoidedEntriesThisPeriod': {
    en: 'No voided time entries in this pay period.',
    es: 'No hay entradas de tiempo anuladas en este período.'
  },
  'payroll.viewPayableTimes': {
    en: 'Payable times',
    es: 'Horas pagaderas'
  },
  'payroll.viewVoidedTimes': {
    en: 'Voided times',
    es: 'Horas anuladas'
  },
  'payroll.voidedTimesDescription': {
    en: 'These records are excluded from hours, pay, and reports. Void from the payable view when a punch was mistaken or entered wrong.',
    es: 'Estas entradas no cuentan para horas, pago ni informes. Anúlelas desde la vista de horas pagaderas si hubo un error.'
  },
  'payroll.entryVoidedBadge': {
    en: 'Voided',
    es: 'Anulada'
  },
  'payroll.voidEntry': {
    en: 'Void',
    es: 'Anular'
  },
  'payroll.voidEntryConfirmTitle': {
    en: 'Void this time entry?',
    es: '¿Anular esta entrada de tiempo?'
  },
  'payroll.voidEntryConfirmDescription': {
    en: 'It will be hidden from pay calculations and reports but kept for your records. You can restore it from Voided times.',
    es: 'No contará en pagos ni informes, pero se conservará. Puede restaurarla desde Horas anuladas.'
  },
  'payroll.voidEntrySuccess': {
    en: 'Time entry voided.',
    es: 'Entrada anulada.'
  },
  'payroll.restoreEntry': {
    en: 'Restore',
    es: 'Restaurar'
  },
  'payroll.restoreVoidedTitle': {
    en: 'Voided time entry',
    es: 'Entrada anulada'
  },
  'payroll.restoreVoidedDescription': {
    en: 'This shift is voided and does not count toward pay. Restore it to include it again in payable times.',
    es: 'Este turno está anulado y no cuenta para el pago. Restaúrelo para incluirlo de nuevo.'
  },
  'payroll.restoreEntrySuccess': {
    en: 'Time entry restored.',
    es: 'Entrada restaurada.'
  },
  'payroll.voidedTotalFooterHint': {
    en: 'Not counted toward pay',
    es: 'No cuenta para el pago'
  },
  'payroll.editTimesHint': {
    en: 'Edit times',
    es: 'Editar horas'
  },
  'payroll.rowEditableHint': {
    en: 'Click to edit clock in and out',
    es: 'Pulse para editar entrada y salida'
  },
  'payroll.downloadPdfReport': {
    en: 'Download Report',
    es: 'Descargar informe'
  },
  'payroll.pdfPopupBlocked': {
    en: 'Could not open a new tab. Check your pop-up settings—the report was downloaded instead.',
    es: 'No se pudo abrir una pestaña nueva. Revise las ventanas emergentes: el informe se descargó en su lugar.'
  },
  'payroll.payCalculations': {
    en: 'Pay calculations',
    es: 'Cálculo de pagos'
  },
  'payroll.payCalculationsDescription': {
    en: 'Pay rates are editable in staff profiles. Gross pay is hours × rate for this period.',
    es: 'Las tarifas se editan en las fichas del personal. El pago bruto es horas × tarifa en este período.'
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
  'reports.totalClients': {
    en: 'Total Clients',
    es: 'Total de Clientes'
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
  'reports.totalRevenueLast30Days': {
    en: 'Total Revenue (Last 30 Days)',
    es: 'Ingresos Totales (Últimos 30 Días)'
  },
  'reports.revenueFromTransactions': {
    en: 'From transactions',
    es: 'De transacciones'
  },
  'reports.revenueDescription': {
    en: 'Daily revenue from transactions (last 7 days)',
    es: 'Ingresos diarios de transacciones (últimos 7 días)'
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
    en: 'Back to Timesheets',
    es: 'Volver a hojas de horas'
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
    en: 'Pay period breakdown by day',
    es: 'Desglose del período de pago por día'
  },
  'timesheet.dateDay': {
    en: 'Date/Day',
    es: 'Fecha/Día'
  },
  'timesheet.clockTimes': {
    en: 'Clock in / out',
    es: 'Entrada / salida'
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
  'form.addPet': {
    en: 'Add pet',
    es: 'Agregar mascota'
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

  // Time Kiosk / Manager UI
  'timeKiosk.managerChoiceTitle': {
    en: 'What would you like to do?',
    es: '¿Qué deseas hacer?'
  },
  'timeKiosk.managerChoiceClockInOut': {
    en: 'Clock in / out',
    es: 'Fichar entrada / salida'
  },
  'timeKiosk.managerChoiceCloseKiosk': {
    en: 'Close kiosk',
    es: 'Cerrar kiosk'
  },
  'timeKiosk.managerChoiceCancel': {
    en: 'Cancel',
    es: 'Cancelar'
  },
  'timeKiosk.clear': {
    en: 'Clear',
    es: 'Limpiar'
  },
  'timeKiosk.cancel': {
    en: 'Cancel',
    es: 'Cancelar'
  },
  'timeKiosk.processing': {
    en: 'Processing...',
    es: 'Procesando...'
  },
  'timeKiosk.geoLocationRequired': {
    en: 'You must be at the store location to clock in',
    es: 'Debes estar en la ubicación de la tienda para entrar'
  },
  'timeKiosk.failedClockInOut': {
    en: 'Failed to clock in/out',
    es: 'No se pudo registrar entrada/salida'
  },
  'timeKiosk.errorOccurred': {
    en: 'An error occurred',
    es: 'Ocurrió un error'
  },
  'timeKiosk.currentlyClockedInSince': {
    en: 'Currently clocked in since',
    es: 'Registrado desde'
  },
  'timeKiosk.returningToPin': {
    en: 'Returning to PIN entry in 3 seconds...',
    es: 'Volviendo a la entrada de PIN en 3 segundos...'
  },
  'timeKiosk.clockedInTitle': {
    en: 'Clocked In',
    es: 'Entró'
  },
  'timeKiosk.clockedOutTitle': {
    en: 'Clocked Out',
    es: 'Salió'
  },
  'timeKiosk.managerPinRequiredTitle': {
    en: 'Set up your punch clock password',
    es: 'Configura la contraseña del reloj de fichaje'
  },
  'timeKiosk.managerPinRequiredDescription': {
    en: 'Punch clock now requires a 6-digit manager PIN. You need it to exit kiosk mode and return to the app.',
    es: 'El reloj de fichaje ahora requiere un PIN de gerente de 6 dígitos. Lo necesitas para salir del quiosco y volver a la app.'
  },
  'timeKiosk.managerPinRequiredToast': {
    en: 'Set a 6-digit punch clock (manager) PIN in Business settings.',
    es: 'Configura un PIN de gerente de 6 dígitos en Configuración del negocio.'
  },
  'timeKiosk.goToBusinessSettings': {
    en: 'Open business settings',
    es: 'Abrir configuración del negocio'
  },
  'timeKiosk.businessNotResolvedTitle': {
    en: 'Could not load your business',
    es: 'No se pudo cargar tu negocio'
  },
  'timeKiosk.businessNotResolvedDescription': {
    en: 'Try going back to the dashboard, then open Punch clock again. If this keeps happening, sign out and sign back in.',
    es: 'Vuelve al panel e intenta abrir el reloj de fichaje de nuevo. Si sigue pasando, cierra sesión y vuelve a entrar.'
  },
  'timeKiosk.goToDashboard': {
    en: 'Go to dashboard',
    es: 'Ir al panel'
  },

  'scheduleCheck.title': {
    en: 'Outside your scheduled shift',
    es: 'Fuera del turno programado'
  },
  'scheduleCheck.body': {
    en: 'You are clocking in at a time that does not match a shift on your schedule. Your time will still be recorded normally; it will simply be tagged as outside the scheduled window. If you have a shift on file, it is shown below for reference.',
    es: 'Estás fichando en un horario que no coincide con un turno en tu agenda. Tu tiempo se registrará igual; solo se marcará como fuera de la ventana programada. Si hay un turno registrado, aparece abajo como referencia.'
  },
  'scheduleCheck.shiftReference': {
    en: 'Scheduled shift on file',
    es: 'Turno registrado'
  },
  'scheduleCheck.cancel': {
    en: 'Cancel',
    es: 'Cancelar'
  },
  'scheduleCheck.continue': {
    en: 'Clock in',
    es: 'Fichar entrada'
  },

  'kioskManager.accessTitle': {
    en: 'Manager Access',
    es: 'Acceso de Gerente'
  },
  'kioskManager.accessDescription': {
    en: 'Enter manager PIN to exit kiosk mode',
    es: 'Ingresa el PIN de gerente para salir del modo quiosco'
  },
  'kioskManager.verifyManagerPin': {
    en: 'Please enter your 6-digit manager PIN',
    es: 'Ingresa tu PIN de gerente de 6 dígitos'
  },
  'kioskManager.businessNotFound': {
    en: 'Business not found',
    es: 'Negocio no encontrado'
  },
  'kioskManager.invalidPin': {
    en: 'Invalid manager PIN',
    es: 'PIN de gerente inválido'
  },
  'kioskManager.failedVerifyPin': {
    en: 'Failed to verify PIN',
    es: 'No se pudo verificar el PIN'
  },
  'kioskManager.cancel': {
    en: 'Cancel',
    es: 'Cancelar'
  },
  'kioskManager.verify': {
    en: 'Verify',
    es: 'Verificar'
  },
  'kioskManager.verifying': {
    en: 'Verifying...',
    es: 'Verificando...'
  },

  // Kiosk manager PIN settings page
  'kioskManagerPinSettings.title': {
    en: 'Kiosk Manager PIN',
    es: 'PIN de Gerente del Quiosco'
  },
  'kioskManagerPinSettings.description': {
    en: 'Set or change the 6-digit PIN used to exit kiosk mode and access the main app. Employee clock-in PINs stay 4 digits.',
    es: 'Configura o cambia el PIN de 6 dígitos para salir del modo quiosco y acceder a la app. Los PIN de fichaje de empleados siguen siendo de 4 dígitos.'
  },
  'kioskManagerPinSettings.currentPin': {
    en: 'Current PIN',
    es: 'PIN actual'
  },
  'kioskManagerPinSettings.enterCurrentPin': {
    en: 'Enter current PIN',
    es: 'Ingresa el PIN actual'
  },
  'kioskManagerPinSettings.newPin': {
    en: 'New PIN (6 digits)',
    es: 'PIN nuevo (6 dígitos)'
  },
  'kioskManagerPinSettings.enterNewPin': {
    en: 'Enter new PIN',
    es: 'Ingresa el PIN nuevo'
  },
  'kioskManagerPinSettings.confirmNewPin': {
    en: 'Confirm New PIN',
    es: 'Confirma el PIN nuevo'
  },
  'kioskManagerPinSettings.confirmNewPinHint': {
    en: 'Confirm new PIN',
    es: 'Confirma el PIN nuevo'
  },
  'kioskManagerPinSettings.save': {
    en: 'Saving...',
    es: 'Guardando...'
  },
  'kioskManagerPinSettings.changePin': {
    en: 'Change PIN',
    es: 'Cambiar PIN'
  },
  'kioskManagerPinSettings.setPin': {
    en: 'Set PIN',
    es: 'Configurar PIN'
  },
  'kioskManagerPinSettings.forgetHint': {
    en: 'Forgot your PIN? Use “Reset with account password” below (managers only).',
    es: '¿Olvidaste tu PIN? Usa “Restablecer con contraseña de la cuenta” abajo (solo gerentes).'
  },

  'kioskManagerPinReset.title': {
    en: 'Reset punch clock password',
    es: 'Restablecer contraseña del reloj de fichaje'
  },
  'kioskManagerPinReset.stepPasswordDescription': {
    en: 'Enter your Grumi account password to prove it is you. Then you can set a new manager PIN.',
    es: 'Ingresa la contraseña de tu cuenta de Grumi para verificar tu identidad. Luego podrás configurar un nuevo PIN de gerente.'
  },
  'kioskManagerPinReset.stepPinDescription': {
    en: 'Choose a new 6-digit manager PIN for the punch clock.',
    es: 'Elige un nuevo PIN de gerente de 6 dígitos para el reloj de fichaje.'
  },
  'kioskManagerPinReset.signedInAs': {
    en: 'Signed in as {email}',
    es: 'Sesión iniciada como {email}'
  },
  'kioskManagerPinReset.accountPassword': {
    en: 'Account password',
    es: 'Contraseña de la cuenta'
  },
  'kioskManagerPinReset.verifyAccount': {
    en: 'Verify',
    es: 'Verificar'
  },
  'kioskManagerPinReset.verifyingAccount': {
    en: 'Verifying…',
    es: 'Verificando…'
  },
  'kioskManagerPinReset.back': {
    en: 'Back',
    es: 'Atrás'
  },
  'kioskManagerPinReset.saveNewPin': {
    en: 'Save new PIN',
    es: 'Guardar nuevo PIN'
  },
  'kioskManagerPinReset.successToast': {
    en: 'Manager PIN updated.',
    es: 'PIN de gerente actualizado.'
  },
  'kioskManagerPinReset.forgotPinLink': {
    en: 'Forgot manager PIN?',
    es: '¿Olvidaste el PIN de gerente?'
  },
  'kioskManagerPinReset.openFromSettings': {
    en: 'Reset with account password',
    es: 'Restablecer con contraseña de la cuenta'
  },
  'kioskManagerPinReset.errors.noEmail': {
    en: 'No email on this session. Sign in with email and password, or contact support.',
    es: 'No hay correo en esta sesión. Inicia sesión con correo y contraseña, o contacta soporte.'
  },
  'kioskManagerPinReset.errors.enterPassword': {
    en: 'Enter your account password.',
    es: 'Ingresa la contraseña de tu cuenta.'
  },
  'kioskManagerPinReset.errors.invalidPassword': {
    en: 'That password didn’t match. Try again.',
    es: 'Esa contraseña no coincide. Inténtalo de nuevo.'
  },
  'kioskManagerPinReset.errors.noBusiness': {
    en: 'Business not loaded. Try again in a moment.',
    es: 'No se cargó el negocio. Intenta de nuevo en un momento.'
  },

  'kioskManagerPinSettings.errors.pin4Digits': {
    en: 'PIN must be exactly 4 digits',
    es: 'El PIN debe tener exactamente 4 dígitos'
  },
  'kioskManagerPinSettings.errors.pin6Digits': {
    en: 'Manager PIN must be exactly 6 digits',
    es: 'El PIN de gerente debe tener exactamente 6 dígitos'
  },
  'kioskManagerPinSettings.errors.pinsDontMatch': {
    en: 'New PINs do not match',
    es: 'Los PIN nuevos no coinciden'
  },
  'kioskManagerPinSettings.errors.enterCurrentPin': {
    en: 'Please enter your current PIN',
    es: 'Ingresa tu PIN actual'
  },
  'kioskManagerPinSettings.errors.failedVerifyCurrentPin': {
    en: 'Failed to verify current PIN',
    es: 'No se pudo verificar el PIN actual'
  },
  'kioskManagerPinSettings.errors.prefixMatchesEmployee': {
    en: 'This PIN cannot be used. Please use another one.',
    es: 'Este PIN no se puede usar. Usa otro.'
  },
  'kioskManagerPinSettings.errors.currentPinIncorrect': {
    en: 'Current PIN is incorrect',
    es: 'El PIN actual es incorrecto'
  },
  'kioskManagerPinSettings.toast.updated': {
    en: 'Manager PIN updated successfully',
    es: 'PIN de gerente actualizado correctamente'
  },
  'kioskManagerPinSettings.toast.failedUpdate': {
    en: 'Failed to update manager PIN',
    es: 'No se pudo actualizar el PIN del gerente'
  },

  // Employee Payroll page (employee report details)
  'employeePayroll.backToPayroll': {
    en: 'Back to Timesheets',
    es: 'Volver a hojas de horas'
  },
  'employeePayroll.employeeNotFound': {
    en: 'Employee Not Found',
    es: 'Empleado no encontrado'
  },
  'employeePayroll.viewTimesheet': {
    en: 'View Timesheet',
    es: 'Ver hoja de tiempo'
  },
  'employeePayroll.payrollSummary': {
    en: 'Payroll Summary',
    es: 'Resumen de Nómina'
  },
  'employeePayroll.weekOf': {
    en: 'Pay period of',
    es: 'Período de pago de'
  },
  'employeePayroll.timeEntries': {
    en: 'Time Entries',
    es: 'Entradas de tiempo'
  },
  'employeePayroll.timekeepingRecords': {
    en: 'Timekeeping Records',
    es: 'Registros de tiempo'
  },
  'employeePayroll.timekeepingDescription': {
    en: 'Detailed breakdown of clock in/out times and hours worked',
    es: 'Desglose detallado de entradas/salidas y horas trabajadas'
  },
  'employeePayroll.noTimeEntries': {
    en: 'No time entries for this pay period',
    es: 'No hay entradas de tiempo para este período de pago'
  },
  'employeePayroll.table.date': {
    en: 'Date',
    es: 'Fecha'
  },
  'employeePayroll.table.hours': {
    en: 'Hours',
    es: 'Horas'
  },
  'employeePayroll.table.pay': {
    en: 'Pay',
    es: 'Pago'
  },
  'employeePayroll.total': {
    en: 'Total',
    es: 'Total'
  },
  'employeePayroll.employeeInformation': {
    en: 'Staff information',
    es: 'Información del personal'
  },
  'employeePayroll.employee.name': {
    en: 'Name',
    es: 'Nombre'
  },
  'employeePayroll.employee.role': {
    en: 'Role',
    es: 'Rol'
  },
  'employeePayroll.employee.email': {
    en: 'Email',
    es: 'Correo'
  },
  'employeePayroll.employee.phone': {
    en: 'Phone',
    es: 'Teléfono'
  },
  'employeePayroll.employee.status': {
    en: 'Status',
    es: 'Estado'
  },
  'employeePayroll.employee.hourlyRate': {
    en: 'Hourly Rate',
    es: 'Tarifa por hora'
  },
  // Additional UI strings (used across the app)
  'clients.noBusinessClients': {
    en: 'No clients yet for this business',
    es: 'Aún no hay clientes para este negocio'
  },
  'clients.noResults': {
    en: 'No results found',
    es: 'No se encontraron resultados'
  },
  'clients.noCustomers': {
    en: 'No customers found',
    es: 'No se encontraron clientes'
  },
  'clients.phoneLabel': {
    en: 'Phone',
    es: 'Teléfono'
  },
  'common.noEmail': {
    en: 'No email',
    es: 'Sin correo'
  },
  'common.unknownPet': {
    en: 'Unknown pet',
    es: 'Mascota desconocida'
  },
  'common.unknownClient': {
    en: 'Unknown client',
    es: 'Cliente desconocido'
  },
  'common.actions': {
    en: 'Actions',
    es: 'Acciones'
  },
  'pets.noPetsFound': {
    en: 'No pets found',
    es: 'No se encontraron mascotas'
  },
  'pets.owner': {
    en: 'Owner',
    es: 'Dueño/a'
  },
  'appointments.linkCopied': {
    en: 'Link copied',
    es: 'Enlace copiado'
  },
  'appointments.noService': {
    en: 'No service selected',
    es: 'No hay servicio seleccionado'
  },
  'appointments.copied': {
    en: 'Copied',
    es: 'Copiado'
  },
  'appointments.copy': {
    en: 'Copy',
    es: 'Copiar'
  },

  'dashboard.petCountDescription': {
    en: 'Pet count by type',
    es: 'Cantidad de mascotas por tipo'
  },
  'reports.totalAppointments': {
    en: 'Total Appointments',
    es: 'Total de citas'
  },
  'reports.totalPets': {
    en: 'Total Pets',
    es: 'Total de mascotas'
  },
  'reports.petDistributionDescription': {
    en: 'Pet distribution breakdown',
    es: 'Desglose de distribución de mascotas'
  },
  'reports.weeklyRegistrationsDescription': {
    en: 'Weekly registrations summary',
    es: 'Resumen de registros semanales'
  },

  'services.serviceDeleted': {
    en: 'Service deleted successfully',
    es: 'Servicio eliminado correctamente'
  },
  'services.deleteError': {
    en: 'Failed to delete service',
    es: 'No se pudo eliminar el servicio'
  },
  'services.noServices': {
    en: 'No services available',
    es: 'No hay servicios disponibles'
  },

  'serviceForm.editService': {
    en: 'Edit Service',
    es: 'Editar servicio'
  },
  'serviceForm.addNewService': {
    en: 'Add New Service',
    es: 'Agregar nuevo servicio'
  },
  'serviceForm.name': {
    en: 'Service name',
    es: 'Nombre del servicio'
  },
  'serviceForm.namePlaceholder': {
    en: 'e.g., Full Grooming',
    es: 'p. ej., Aseo completo'
  },
  'serviceForm.price': {
    en: 'Price',
    es: 'Precio'
  },
  'serviceForm.duration': {
    en: 'Duration',
    es: 'Duración'
  },
  'serviceForm.durationHint': {
    en: 'Duration in minutes',
    es: 'Duración en minutos'
  },
  'serviceForm.minutes': {
    en: 'minutes',
    es: 'minutos'
  },
  'serviceForm.status': {
    en: 'Status',
    es: 'Estado'
  },
  'serviceForm.active': {
    en: 'Active',
    es: 'Activo'
  },
  'serviceForm.inactive': {
    en: 'Inactive',
    es: 'Inactivo'
  },
  'serviceForm.description': {
    en: 'Description',
    es: 'Descripción'
  },
  'serviceForm.descriptionPlaceholder': {
    en: 'Optional description...',
    es: 'Descripción opcional...'
  },
  'serviceForm.updateService': {
    en: 'Save Service',
    es: 'Guardar servicio'
  },
  'serviceForm.addService': {
    en: 'Add Service',
    es: 'Agregar servicio'
  },
  'services.deleteServiceTitle': {
    en: 'Delete Service',
    es: 'Eliminar servicio'
  },
  'services.deleteServiceDescription': {
    en: 'Are you sure you want to delete this service?',
    es: '¿Estás seguro de eliminar este servicio?'
  },

  'personalization.saveError': {
    en: 'Failed to save settings',
    es: 'No se pudo guardar la configuración'
  },
  'personalization.businessInfo': {
    en: 'Business Info',
    es: 'Información del negocio'
  },
  'personalization.businessInfoDescription': {
    en: 'Update your business details used across the app',
    es: 'Actualiza los datos del negocio usados en la aplicación'
  },
  'personalization.email': {
    en: 'Email',
    es: 'Correo'
  },
  'personalization.phone': {
    en: 'Phone',
    es: 'Teléfono'
  },
  'personalization.website': {
    en: 'Website',
    es: 'Sitio web'
  },
  'personalization.address': {
    en: 'Address',
    es: 'Dirección'
  },
  'personalization.city': {
    en: 'City',
    es: 'Ciudad'
  },
  'personalization.state': {
    en: 'State',
    es: 'Estado'
  },
  'personalization.zipCode': {
    en: 'ZIP Code',
    es: 'Código Postal'
  },
  'personalization.subscription': {
    en: 'Subscription',
    es: 'Suscripción'
  },
  'personalization.subscriptionDescription': {
    en: 'Manage your subscription details',
    es: 'Administra los detalles de tu suscripción'
  },
  'personalization.plan': {
    en: 'Plan',
    es: 'Plan'
  },
  'personalization.status': {
    en: 'Status',
    es: 'Estado'
  },
  'personalization.trialEnds': {
    en: 'Trial ends on',
    es: 'La prueba termina el'
  },

  'timeClock.clockedIn': {
    en: 'Clocked In',
    es: 'Entró'
  },

  'payroll.saveChanges': {
    en: 'Save Changes',
    es: 'Guardar cambios'
  },
  // Business Pay Schedule
  'businessSettings.paySchedule': {
    en: 'Pay Schedule',
    es: 'Calendario de Nómina'
  },
  'businessSettings.payScheduleDescription': {
    en: 'Configure the anchor date and how often pay periods repeat.',
    es: 'Configura la fecha ancla y cada cuántas semanas se repiten los períodos de pago.'
  },
  'businessSettings.payScheduleAnchorDate': {
    en: 'Pay schedule anchor date',
    es: 'Fecha ancla del calendario de nómina'
  },
  'businessSettings.payScheduleCadenceWeeks': {
    en: 'Pay cadence (weeks)',
    es: 'Cadencia de pago (semanas)'
  },
  'businessSettings.cadenceEvery1Week': {
    en: 'Every 1 week',
    es: 'Cada 1 semana'
  },
  'businessSettings.cadenceEvery2Weeks': {
    en: 'Every 2 weeks',
    es: 'Cada 2 semanas'
  },
  'businessSettings.cadenceEvery3Weeks': {
    en: 'Every 3 weeks',
    es: 'Cada 3 semanas'
  },
  'businessSettings.cadenceEvery4Weeks': {
    en: 'Every 4 weeks',
    es: 'Cada 4 semanas'
  },
  'businessSettings.payScheduleSave': {
    en: 'Save Pay Schedule',
    es: 'Guardar calendario de nómina'
  },
  'businessSettings.payScheduleSaved': {
    en: 'Pay schedule saved successfully!',
    es: '¡Calendario de nómina guardado correctamente!'
  },
  'businessSettings.payrollPdfIncludeLogo': {
    en: 'Logo on payroll PDF',
    es: 'Logo en PDF de nómina'
  },
  'businessSettings.payrollPdfIncludeLogoDescription': {
    en: 'When enabled, your business logo appears at the top-left of the payroll report PDF (raster images only).',
    es: 'Si está activado, el logo del negocio aparece arriba a la izquierda en el PDF de nómina (solo imágenes raster).'
  },
  'businessSettings.kioskWarnOffSchedule': {
    en: 'Punch clock: off-schedule notice',
    es: 'Reloj de fichaje: aviso fuera de turno'
  },
  'businessSettings.kioskWarnOffScheduleDescription': {
    en: 'When on, employees see a short notice if they clock in outside their scheduled shift (time is still saved). Turn off if you do not use schedules or prefer not to show this message.',
    es: 'Si está activo, los empleados ven un aviso breve si fichan fuera del turno programado (el tiempo se guarda igual). Desactívalo si no usas horarios o no quieres este mensaje.'
  },
  'businessSettings.kioskWarnOffScheduleEnabledLabel': {
    en: 'Show off-schedule notice on punch clock',
    es: 'Mostrar aviso de fuera de turno en el reloj'
  },
  'businessSettings.allowEmployeeMobilePunch': {
    en: 'Employee punch clock on their phones',
    es: 'Fichaje desde el teléfono del empleado'
  },
  'businessSettings.allowEmployeeMobilePunchDescription': {
    en: 'When on, staff with the employee role see Punch clock in their sidebar and can open the time kiosk from their own device (in addition to the storefront kiosk).',
    es: 'Si está activo, el personal con rol empleado ve Reloj de fichaje en el menú y puede abrir el kiosco de tiempo desde su propio dispositivo (además del kiosco en tienda).'
  },
  'businessSettings.allowEmployeeMobilePunchEnabledLabel': {
    en: 'Let employees use punch clock on their phones',
    es: 'Permitir fichar desde el teléfono del empleado'
  },
  'businessSettings.mapsEmbedUrl': {
    en: 'Google Maps embed',
    es: 'Mapa de Google (embed)'
  },
  'businessSettings.mapsEmbedUrlHint': {
    en: 'Paste the Maps share link or the iframe src URL. Shown on the client portal store locator.',
    es: 'Pega el enlace de compartir o la URL src del iframe. Se muestra en el portal del cliente.'
  },

  'transactions.status': {
    en: 'Status',
    es: 'Estado'
  },
};

let currentLanguage: Language = 'es';

export const setLanguage = (lang: Language) => {
  currentLanguage = lang;
  if (typeof window !== 'undefined' && isDemoMode()) {
    localStorage.setItem(DEMO_LANGUAGE_STORAGE_KEY, lang);
  } else {
    localStorage.setItem('language', lang);
  }
  // Dispatch event to notify components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('languagechange'));
  }
};

export const getLanguage = (): Language => {
  if (typeof window !== 'undefined' && isDemoMode()) {
    const storedDemo = localStorage.getItem(DEMO_LANGUAGE_STORAGE_KEY) as Language;
    return storedDemo || 'es';
  }
  const stored = localStorage.getItem('language') as Language;
  // Default to Spanish (es) for Puerto Rico audience when nothing is stored
  return stored || 'es';
};

export const t = (key: string, params?: Record<string, string | number>): string => {
  const translation = translations[key];
  if (!translation) {
    devConsole.warn(`Translation missing for key: ${key}`);
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
