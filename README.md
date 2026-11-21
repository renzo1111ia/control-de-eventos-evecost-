# Control de Gastos & Acceso para Productoras de Eventos

> Plataforma completa de gestión financiera, inventario de barra y control de acceso por QR con alta ciberseguridad, diseñada para la industria del entretenimiento nocturno, festivales y eventos.

---

## 🚀 Inicio Rápido (En 1 Clic)

En la carpeta principal del proyecto:
1. Haz doble clic en **`iniciar_todo.bat`**
2. Se abrirán dos ventanas: una para el **Backend (puerto 4000)** y otra para el **Frontend (puerto 5173)**.
3. Abre tu navegador en: **`http://localhost:5173`**

*(También puedes iniciarlos por separado con `iniciar_backend.bat` e `iniciar_frontend.bat`).*

---

## 🛠️ Estructura del Proyecto en Disco D:

```
D:\control de gastos productoras app\
├── backend/
│   ├── src/
│   │   ├── server.js            # Servidor API Express con Helmet & Rate-Limit
│   │   ├── db.js                # Adaptador Universal (SQLite local / PostgreSQL nube)
│   │   ├── schema.js            # Auto-migración y creación de tablas
│   │   ├── config.js            # Variables de entorno y ajustes
│   │   └── utils/
│   │       ├── rut.js           # Validador de RUT chileno (Módulo 11)
│   │       ├── crypto.js        # Firmas digitales HMAC-SHA256 para QRs
│   │       └── mailer.js        # Emisión de tickets y envío de correos
│   ├── data/
│   │   └── eventos.db           # Base de datos SQLite local (cero configuración externa)
│   └── .env                     # Claves secretas y configuración
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Controlador principal y gestión de estado
│   │   ├── components/
│   │   │   ├── SetupModal.jsx          # Modal bloqueante inicial (Productora + Barra)
│   │   │   ├── EventSelectorModal.jsx  # Selector y creador de múltiples eventos
│   │   │   ├── Navbar.jsx              # Barra superior y navegación por pestañas
│   │   │   ├── FinanceModule.jsx       # KPIs de margen, break-even y libro contable
│   │   │   ├── AttendeesModule.jsx     # Emisión de entradas QR y validación de RUT
│   │   │   ├── BarStockModule.jsx      # Control de barra, POS rápido y arqueo de caja
│   │   │   ├── ScannerModule.jsx       # Escáner de cámara, cotejo de RUT y audio
│   │   │   └── AuditModule.jsx         # Registro inmutable de ciberseguridad
│   │   └── utils/
│   │       ├── audio.js         # Sintetizador Web Audio API para bips en puerta
│   │       └── rut.js           # Formateo y validación reactiva de RUT
│   └── package.json
├── docs/
│   ├── arquitectura_y_ciberseguridad.md
│   ├── referencia_gemini_parte1.txt
│   └── referencia_gemini_parte2.txt
├── iniciar_backend.bat
├── iniciar_frontend.bat
└── iniciar_todo.bat
```

---

## 🛡️ Características Principales y Ciberseguridad

1. **Popup Bloqueante Inicial (1 sola vez por evento)**:
   * Solicita el nombre oficial de la productora (se usa como remitente en correos).
   * Pregunta si el evento tiene barra o no. Si se responde SÍ, habilita el módulo de barra y guía al inventario inicial. Si se responde NO, lo oculta totalmente.
2. **Firma Digital HMAC-SHA256 en Tickets QR**:
   * Cada QR está criptográficamente firmado. Cualquier intento de modificar el ticket o usar uno de otro evento genera una alerta inmediata de **CÓDIGO QR FALSIFICADO / INVÁLIDO**.
3. **Control Anti-Repetición (Anti-Replay)**:
   * Evita que dos personas entren con la misma entrada o con una captura de pantalla compartida por WhatsApp. Muestra la hora exacta del ingreso anterior en color ámbar.
4. **Cotejo de RUT Chileno en Pantalla Gigante**:
   * El personal de seguridad en puerta ve en gigante el nombre y el RUT del titular en verde para verificar contra la cédula física del asistente.
5. **Arqueo y Cierre de Barra Anti-Robo**:
   * Compara el inventario inicial menos el sobrante físico contra el dinero registrado en caja/POS para detectar faltantes o mermas de bartenders.
6. **Márgenes y Break-Even en Tiempo Real**:
   * Cruza automáticamente las entradas vendidas, las ventas de barra y los costos fijos (DJs, predio, sonido, seguridad).
