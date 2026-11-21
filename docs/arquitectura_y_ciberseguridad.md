# Arquitectura y Manual de Ciberseguridad
## Plataforma de Gestión Financiera, Barra y Control de Acceso para Productoras de Eventos

---

### 1. Visión General de la Solución
Esta aplicación fue diseñada específicamente para la operativa real de **productoras de eventos, festivales, clubes y fiestas**, resolviendo los tres puntos críticos donde se definen las ganancias o pérdidas de una fecha:
1. **Fuga en puerta**: Falsificación de entradas, reventa de capturas de pantalla, ingreso de personas con entradas ajenas o doble ingreso del mismo QR.
2. **Merma y robo en barra**: Descuadre entre las botellas abiertas y el dinero recaudado en cajas o terminales POS.
3. **Descontrol financiero en vivo**: No saber en tiempo real si el evento ya superó su punto de equilibrio (Break-even) o si está en números rojos tras pagar DJs, sonido, arriendo y seguridad.

---

### 2. Capa de Ciberseguridad Aplicada

#### A. Firma Digital HMAC-SHA256 (Anti-Falsificación de Entradas)
* Cada código QR generado no contiene simplemente un ID legible que cualquiera podría inventar o alterar.
* Se calcula una firma criptográfica `HMAC-SHA256` combinando:
  $$\text{Firma} = \text{HMAC-SHA256}(\text{ClaveSecreta}, \text{eventId} + ":" + \text{attendeeId} + ":" + \text{RUT})$$
* **Defensa activa**: Si alguien altera el ID o copia un QR de otro evento, la firma fallará en la puerta y el escáner mostrará de inmediato una pantalla roja con alerta de seguridad (`status: 'FAKE'`).
* Para evitar ataques de análisis de tiempo (**Timing Attacks**), la comparación de la firma se ejecuta en tiempo constante con `crypto.timingSafeEqual()`.

#### B. Prevención de Ataques de Repetición (Anti-Replay Attack)
* Un asistente deshonesto podría reenviar la captura de pantalla de su QR a varios amigos.
* El sistema implementa una transacción atómica: apenas el primer asistente escanea su QR, el estado `is_checked_in` pasa a `1` y se sella la fecha y hora exacta (`checked_in_at`).
* Cualquier intento posterior de ingreso con la misma entrada dispara una pantalla ámbar parpadeante:
  **"¡ENTRADA YA UTILIZADA ANTERIORMENTE!"** junto a la hora en que ingresó el titular original.

#### C. Cotejo Físico de Identidad (RUT Chileno con Módulo 11)
* Al ingresar un asistente se valida rigurosamente el dígito verificador del RUT chileno (algoritmo Módulo 11).
* En el momento del escaneo, el sistema proyecta en tamaño gigante en la pantalla del guardia de seguridad:
  * **Nombre Completo del Titular**
  * **RUT en Verde Neón de Alta Visibilidad**
* Esto obliga al asistente a mostrar su Cédula de Identidad física en puerta para garantizar que quien entra es realmente el dueño de la entrada.

#### D. Hardening de Servidor y Rate Limiting
* **Helmet.js**: Cabeceras de seguridad activas (X-Frame-Options, DNS Prefetch Control, X-Content-Type-Options).
* **Rate Limiting en Puerta**: El endpoint de escaneo `/api/events/:eventId/scan` tiene un límite estricto de 120 peticiones por minuto para neutralizar ataques automatizados de fuerza bruta sobre los tokens QR.
* **Sanitización de Plantillas HTML**: Se previene inyección de código (XSS) en los correos salientes mediante el escape seguro de caracteres HTML.
* **Logs de Auditoría Inmutables**: Toda acción sensible (emisión de entradas, escaneos autorizados, alertas de QR falsos, registros contables y cierres de barra) queda grabada en la tabla `audit_logs` con IP y timestamp.

---

### 3. Módulos Operativos

#### 🍸 Modal Bloqueante Inicial (1 Sola Vez por Evento)
* Al crear o acceder por primera vez a un evento nuevo (`is_configured === 0`), el sistema bloquea el acceso con un modal inicial obligatorio:
  1. **Nombre de la Productora**: Se almacena para que todos los correos con entradas QR lleven el nombre de la productora como remitente oficial.
  2. **Correo de Contacto**: Define el `Reply-To` del correo de entradas.
  3. **Switch de Barra**: Si se marca **SÍ**, se habilita en el menú el módulo "Control de Barra & Stock" y se orienta al usuario a cargar el stock inicial. Si se marca **NO**, la barra queda totalmente oculta y se excluye de las finanzas.
* Una vez enviado, se actualiza `is_configured = 1` y no vuelve a interrumpir la navegación.

#### 👥 Emisión de Entradas & Correo Dinámico
* Generación de entradas por sectores (Preventa 1, Preventa 2, Puerta General, VIP).
* Generación instantánea de QR en Base64.
* Registro automático del monto pagado como **INGRESO** en el módulo de finanzas.
* Despacho automático de correo electrónico formateado profesionalmente con logo, datos y código QR adjunto.

#### 📦 Stock de Barra, POS Rápido y Arqueo de Caja
* **Carga Inicial**: Cantidad de botellas/latas, costo unitario de compra y precio de venta. El costo total de compra se suma automáticamente a los **GASTOS** del evento.
* **Terminal POS Rápido**: Botones para marcar ventas en 1 clic ("Tarjeta" o "Efectivo"), descontando stock en vivo y sumando el dinero a los ingresos.
* **Arqueo y Cierre de Barra**: Al finalizar el evento, se ingresa el dinero físico contado en cajas y vouchers POS. El sistema calcula:
  $$\text{Ventas Teóricas} = \sum (\text{Precio Venta} \times \text{Unidades Vendidas})$$
  $$\text{Discrepancia} = \text{Dinero Real Contado} - \text{Ventas Teóricas}$$
  Detecta al instante si la caja está cuadrada ($0$), si hay un faltante (robo o trago no cobrado) o un sobrante.

#### 📊 Finanzas y Punto de Equilibrio (Break-Even)
* Dashboard en vivo con:
  * Ingresos Totales (Entradas + Barra + Auspicios manuales).
  * Gastos Totales (Compra Barra + DJs + Arriendo + Técnica + Seguridad).
  * Margen Operativo Neto ($).
  * Indicador porcentual de Break-even para saber si los costos fijos ya fueron 100% cubiertos por la taquilla.

---

### 4. Portabilidad de Base de Datos (SQLite + PostgreSQL)
El backend incluye un **Universal Database Adapter** (`src/db.js`):
* **Desarrollo Local**: Usa `better-sqlite3` guardando los datos en `backend/data/eventos.db`. No requiere instalar PostgreSQL ni Docker en la máquina para empezar a usarla de inmediato.
* **Producción en la Nube**: Simplemente define la variable `DATABASE_URL=postgresql://...` en `backend/.env` y el sistema se conecta a PostgreSQL de forma automática y transparente.
