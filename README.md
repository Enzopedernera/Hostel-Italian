# El Italian Hostel — hostelitalian-vanilla

Sitio web del Hostel El Italian, Villa La Angostura, Patagonia.
Stack: HTML / SCSS / Vanilla JS (ES Modules).

---

## Estructura

```
hostelitalian-vanilla/
├── css/
│   ├── main.scss          ← entry point SCSS
│   ├── main.css           ← compilado (no editar directamente)
│   ├── _variables.scss    ← paleta, tipografías, breakpoints
│   ├── _base.scss         ← reset, .container, tipografía base
│   ├── _navbar.scss       ← navbar fija + mobile menu
│   ├── _hero.scss         ← hero fullscreen
│   ├── _sections.scss     ← galería, rooms, servicios
│   ├── _bottom.scss       ← reservas, location, reviews, footer
│   └── _pages.scss        ← páginas internas + wizard de reservas
├── js/
│   ├── main.js            ← entrada: partials, navbar, animaciones
│   ├── reservation.js     ← wizard de reservas (3 pasos)
│   ├── calendar.js        ← componente de calendario visual
│   └── storage.js         ← persistencia en localStorage
├── partials/
│   ├── header.html
│   └── footer.html
├── img/                   ← colocar las imágenes aquí
│   └── (ver lista abajo)
├── index.html
├── habitaciones.html
├── servicios.html
├── ubicacion.html
├── resenas.html
└── reservar.html          ← wizard de reservas
```

---

## Compilar SCSS

```bash
# Instalar Sass globalmente (una sola vez)
npm install -g sass

# Compilar con watch
sass css/main.scss css/main.css --watch

# Compilar una vez (producción)
sass css/main.scss css/main.css --style=compressed
```

---

## Servir localmente

Los módulos JS (`type="module"`) requieren un servidor HTTP.
No abrir los HTML directamente con `file://`.

```bash
# Con Node.js
npx serve .

# Con Python
python3 -m http.server 3000
```

---

## Imágenes necesarias

Colocar en `/img/`:

| Archivo             | Uso                         |
|---------------------|-----------------------------|
| hero.jpg            | Hero homepage y sub-pages   |
| gallery-1.jpg       | Galería — espacio común     |
| gallery-2.jpg       | Galería — habitación priv.  |
| gallery-3.jpg       | Galería — desayuno          |
| gallery-4.jpg       | Galería — vista al lago     |
| gallery-5.jpg       | Galería — dorm compartido   |
| room-dorm.jpg       | Habitaciones — dorm main    |
| room-dorm-2.jpg     | Habitaciones — dorm thumb   |
| room-dorm-3.jpg     | Habitaciones — locker       |
| room-private.jpg    | Habitaciones — privada main |
| room-private-2.jpg  | Habitaciones — baño priv.   |
| room-private-3.jpg  | Habitaciones — vista bosque |

---

## Sistema de reservas

El sistema guarda las reservas en `localStorage` del navegador.
Para uso real (con persistencia server-side) se debe conectar
`storage.js` a una API REST o servicio como Firebase/Supabase.

### Configurar precios y número de WhatsApp

En `js/storage.js`, modificar `DEFAULT_CONFIG`:

```js
const DEFAULT_CONFIG = {
  prices: {
    dorm:    25000,   // ARS por noche por persona
    private: 65000,   // ARS por noche
  },
  waNumber: '5492944000000', // Número real sin + ni espacios
  ...
};
```

---

## Fixes incluidos vs. versión original

1. **_pages.scss** — eliminado bloque `@use` duplicado que impedía compilar.
2. **_navbar.scss** — mobile menu usa `visibility` + `opacity` en vez de
   `display:none`, permitiendo que las transiciones CSS funcionen.
3. **main.js** — refactorizado como ES Module; lógica de reservas
   extraída a `reservation.js`.
4. **reservar.html** — reemplazado formulario simple por wizard de 3 pasos
   con calendario visual y persistencia en localStorage.
