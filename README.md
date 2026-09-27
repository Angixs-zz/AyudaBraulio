# Braulio · Network Lab

Un espacio de estudio de conmutación hecho para Braulio: explicaciones claras, prácticas de verano reconstruidas, comandos buscables, mapas interactivos y el simulador Cisco de Angixs.

**Web:** https://angixs-zz.github.io/AyudaBraulio/

## Qué incluye

- **12 temas:** fundamentos Ethernet, IOS, direccionamiento, interfaces, VLAN, trunks/SVI, rutas estáticas, RIPv2, OSPF, EIGRP, DHCP y Port Security.
- **8 prácticas guiadas:** configuración básica, tres routers con estáticas, cuatro routers con RIP, cuatro con OSPF, campus por VLAN, DHCP por departamento, violación de Port Security y limpieza del switch.
- **Mapa de paquetes:** compara conmutación local y enrutamiento inter-VLAN. Es una visualización didáctica, no un emulador de paquetes.
- **Generador por departamento:** configuración de enlace, distribución, CORE de una rama y DHCP, con descarga `.txt`.
- **Calculadora IPv4:** red, máscara, wildcard, broadcast y hosts, con tratamiento de /31 y /32.
- **40 comandos** con modo IOS, explicación y copia; buscador global y archivo de apuntes buscable por contenido.
- **24 preguntas** con explicación y tarjetas de repaso. Reto general de 6 preguntas o 2 por tema.
- **Progreso local:** temas, marcadores, checklist y resultados guardados en este navegador. No requiere cuenta ni servidor de datos. Las casillas son autoevaluación, no verifican Packet Tracer.
- **Simulador 2960 integrado** en `simulador/`: guiado, examen, libre y limpieza.

## Desarrollo

Requiere Node.js 22 (Vite requiere 22.12 o superior en esta rama).

```sh
npm ci
npm run dev
```

Abre la dirección que imprime Vite. La aplicación utiliza módulos y debe servirse por HTTP; no abrir `index.html` del dashboard con `file://`.

```sh
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

Las pruebas de navegador levantan la **compilación de producción**, incluyendo el simulador. La salida publicable está en `dist/` y utiliza rutas relativas para funcionar bajo `/AyudaBraulio/`. `simulador/` se copia durante el build y conserva su service worker limitado a su propia ruta y caché. El dashboard no promete funcionamiento sin conexión; el simulador conserva su funcionalidad PWA después de la primera carga en navegadores compatibles.

## Material y correcciones

Los 43 Markdown de la carpeta local `Conmutacion/` entregada por Angixs se conservan, con texto original y SHA-256, en `public/apuntes/originales.json`: 41 con contenido y 2 vacíos. Se pueden leer y descargar desde la biblioteca. No se recibieron las imágenes enlazadas desde Obsidian ni archivos Packet Tracer `.pkt`; la web identifica esas ausencias y reconstruye diagramas y guías.

Para actualizar la importación desde una carpeta de apuntes:

```sh
npm run import:notes -- /ruta/a/Conmutacion
```

El archivo generado está versionado; **ni el build ni CI necesitan la carpeta externa**.

Las explicaciones revisadas están en `src/content.js`; las prácticas completas en `src/practices.js`. Cada lección enlaza sus apuntes de origen. La biblioteca presenta correcciones y referencias RFC/Cisco. Entre los ajustes principales:

- Área 0 de OSPF = backbone; process ID local, router ID único, costo distinto de congestión instantánea.
- CSMA/CD corresponde a Ethernet half-duplex; mDNS usa multicast y Gigabit equivale a 1,000 Mb/s.
- `172.32.0.0/16` no pertenece a RFC 1918; se conserva solo dentro de escenarios originales aislados.
- Las LAN /24 usan `255.255.255.0`, no la máscara no contigua `255.255.255.8` de un apunte.
- `network` en RIP IOS selecciona redes mayores classful; en OSPF, interfaces mediante IP/wildcard.
- Un trunk transporta VLAN, no enruta. El CORE de la reconstrucción necesita un modelo multicapa compatible, SVIs operativas e `ip routing`.
- `ip default-gateway` es para administración del switch sin routing; cada PC necesita el gateway de su VLAN.
- DHCP no se limita al CORE; NAT es independiente; se corrige el gateway del pool y se explica APIPA.
- Sticky se guarda después de aprender la MAC. Recuperar un puerto exige retirar la causa de la violación.
- EIGRP es un **complemento didáctico** porque el apunte original solo contenía una introducción y wildcards.

### Dos escenarios que no deben mezclarse

| | Campus de verano | Simulador Cisco |
|---|---|---|
| Departamentos | VLAN 101–110 | VLAN 110–118 |
| Administración | VLAN 100, 10.168.0.0/24 | VLAN 1, 200.1.2.0/24 |
| Sistemas | VLAN 101 | VLAN 110 |
| Industrial | VLAN 108 | VLAN 116 |
| Servicios compartidos | 23, 301, 302 | 119, 120, 121 |

El generador reconstruye **una rama a la vez**. Al añadir departamentos usa diferentes puertos del CORE y suficientes interfaces físicas. Los puertos de los apuntes PT-EMPTY se normalizan a Gi0/1 (uplink) y Gi0/2 (downlink de distribución); adapta el cableado al equipo. La elección de DCE depende del cableado y se verifica antes de configurar `clock rate`. Algunos modelos multicapa exigen `switchport trunk encapsulation dot1q` antes de `switchport mode trunk`.

## Procedencia del simulador

Importado de [Angixs-zz/Cisco](https://github.com/Angixs-zz/Cisco), commit [`7107dfd9fef540a8406eeb804a8eca979e7044e3`](https://github.com/Angixs-zz/Cisco/commit/7107dfd9fef540a8406eeb804a8eca979e7044e3). Se añadió enlace de regreso, aviso de escenario y aislamiento de caché para no borrar cachés de otros proyectos en el mismo origen. El README original está en `simulador/README.md`. Es un simulador educativo de un subconjunto de IOS; DHCP, routing y Port Security se practican con las guías en Packet Tracer.

## Publicación

`.github/workflows/pages.yml` ejecuta lint, pruebas unitarias, pruebas Chromium y build. En `main`, publica `dist/` en GitHub Pages. Configura **Settings → Pages → Source: GitHub Actions**. Los pushes posteriores a `main` actualizan la web tras superar las comprobaciones.

## Estructura

```text
src/app.js                 Vistas, navegación, interacciones y progreso
src/styles.css             Diseño responsive con la paleta del simulador
src/content.js             Lecciones, comandos, preguntas y fuentes
src/practices.js           Guías y configuraciones completas
src/network.js             Cálculo IPv4, generador y modelo de paquetes
src/storage.js             Persistencia tolerante a fallos
src/ui.js                  Iconos, diagrama SVG y Markdown sanitizado
public/apuntes/            Originales de clase con procedencia
simulador/                 Integración del repositorio Cisco
scripts/                   Importación de material y empaquetado
tests/                     Pruebas de comportamiento y recorridos web
```
