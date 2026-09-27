import { campusConfig } from './network.js';

const wrap = body => `enable\nconfigure terminal\n${body}\nend\nwrite memory`;
const port = (name, ip, prefix = 24) => `interface ${name}\n ip address ${ip} ${prefix === 30 ? '255.255.255.252' : '255.255.255.0'}\n no shutdown\nexit`;
const serials = [
  [['serial0/0/1', '192.168.1.1'], ['serial0/0/0', '192.168.1.5']],
  [['serial0/0/0', '192.168.1.6'], ['serial0/0/1', '192.168.1.9']],
  [['serial0/0/1', '192.168.1.2'], ['serial0/0/0', '192.168.1.13']],
  [['serial0/0/1', '192.168.1.10'], ['serial0/0/0', '192.168.1.14']],
];
export const ripConfigs = Object.fromEntries(serials.map((interfaces, i) => {
  const a = 7 + i * 2;
  return [`R${i + 1}`, wrap(`hostname R${i + 1}\n${port('gigabitEthernet0/0', `${a}.0.0.1`)}\n${port('gigabitEthernet0/1', `${a + 1}.0.0.1`)}\n${interfaces.map(([name, ip]) => port(name, ip, 30)).join('\n')}\nrouter rip\n version 2\n network ${a}.0.0.0\n network ${a + 1}.0.0.0\n network 192.168.1.0\n no auto-summary\n passive-interface gigabitEthernet0/0\n passive-interface gigabitEthernet0/1`)];
}));

const ospfNets = [
  ['192.168.1.1', '172.16.0.1', '192.168.3.1', '200.1.0.1'],
  ['172.32.16.1', '200.1.2.1', '192.168.3.2', '171.127.65.1'],
  ['172.32.0.1', '195.50.50.1', '200.1.0.2', '185.145.120.1'],
  ['172.16.32.1', '192.168.2.1', '171.127.65.2', '185.145.120.2'],
];
export const ospfConfigs = Object.fromEntries(ospfNets.map((ips, i) => [`R${i + 1}`, wrap(`hostname R${i + 1}\n${ips.map((ip, n) => port(['gigabitEthernet0/0', 'gigabitEthernet0/1', 'serial0/0/0', 'serial0/0/1'][n], ip, n < 2 ? 24 : 30)).join('\n')}\nrouter ospf 1\n router-id 0.0.0.${i + 1}\n${ips.map((ip, n) => ` network ${ip.slice(0, ip.lastIndexOf('.'))}.0 ${n < 2 ? '0.0.0.255' : '0.0.0.3'} area 0`).join('\n')}\n passive-interface gigabitEthernet0/0\n passive-interface gigabitEthernet0/1`)]));

export const staticConfigs = {
  R1: wrap(`hostname R1\n${port('gigabitEthernet0/0', '192.168.0.1')}\n${port('gigabitEthernet0/1', '192.168.1.1')}\n${port('serial0/1/0', '209.168.130.65', 30)}\n${[2, 3, 4, 5].map(n => `ip route 192.168.${n}.0 255.255.255.0 209.168.130.66`).join('\n')}\nip route 185.145.127.0 255.255.255.252 209.168.130.66`),
  R2: wrap(`hostname R2\n${port('gigabitEthernet0/0', '192.168.2.1')}\n${port('gigabitEthernet0/1', '192.168.3.1')}\n${port('serial0/1/0', '209.168.130.66', 30)}\n${port('serial0/0/0', '185.145.127.1', 30)}\nip route 192.168.0.0 255.255.255.0 209.168.130.65\nip route 192.168.1.0 255.255.255.0 209.168.130.65\nip route 192.168.4.0 255.255.255.0 185.145.127.2\nip route 192.168.5.0 255.255.255.0 185.145.127.2`),
  R3: wrap(`hostname R3\n${port('gigabitEthernet0/0', '192.168.4.1')}\n${port('gigabitEthernet0/1', '192.168.5.1')}\n${port('serial0/0/0', '185.145.127.2', 30)}\n${[0, 1, 2, 3].map(n => `ip route 192.168.${n}.0 255.255.255.0 185.145.127.1`).join('\n')}\nip route 209.168.130.64 255.255.255.252 185.145.127.1`),
};

export const practices = [
  {
    id: 'primer-switch', number: '01', title: 'Tu primer switch, listo', topic: 'ios', level: 'Para empezar', minutes: 15, icon: 'terminal',
    goal: 'Identificar los modos IOS, nombrar un switch, proteger la consola y guardar la configuración.',
    needs: 'Un 2960 en Packet Tracer o el simulador integrado. En el simulador, selecciona Laboratorio libre para explorar.',
    steps: [
      ['Abre la consola', 'Conecta el cable de consola al puerto Console (no a Gigabit), abre Terminal en la PC y acepta sus parámetros. En Packet Tracer también puedes abrir directamente CLI.', 'enable\nconfigure terminal', 'El prompt termina en (config)#.'],
      ['Ponle identidad', 'Configura hostname, contraseña privilegiada y consola. Todos los valores de este ejercicio son de laboratorio.', 'hostname SW-BRAULIO\nenable secret 12345\nline console 0\n password 12345\n login\nexit', 'Ves SW-BRAULIO(config)# y password/login bajo line con 0.'],
      ['Completa la configuración básica', 'Configura líneas VTY, ofuscación de contraseñas y aviso. Esto todavía no configura SSH.', 'line vty 0 15\n password 12345\n login\nexit\nservice password-encryption\nbanner motd #ACCESO SOLO AUTORIZADO#\nend', 'show running-config contiene el hostname, las líneas y el banner.'],
      ['Guarda y demuestra', 'Compara la configuración activa con la de arranque. Anota qué modo requiere cada comando.', 'write memory\nshow running-config\nshow startup-config', 'La configuración de arranque incluye los cambios. Puedes explicar la diferencia entre RAM y startup-config.'],
    ],
    troubleshooting: 'Si un comando no entra, mira el prompt y usa ?. El número de líneas VTY depende del equipo. Cambiar hostname no altera el cableado ni crea conectividad.',
  },
  {
    id: 'rutas-estaticas', number: '02', title: 'Tres routers, un camino', topic: 'estatico', level: 'Paso a paso', minutes: 30, icon: 'route',
    goal: 'Comunicar seis LAN usando rutas estáticas con caminos de ida y de regreso.',
    needs: 'Tres routers con módulos seriales compatibles, seis PCs y enlaces según la tabla. Las IP públicas se conservan del ejercicio original para una simulación aislada.',
    table: '| Enlace | Extremo A | Extremo B | Máscara |\n|---|---|---|---|\n| R1–R2 | R1 S0/1/0: 209.168.130.65 | R2 S0/1/0: 209.168.130.66 | /30 |\n| R2–R3 | R2 S0/0/0: 185.145.127.1 | R3 S0/0/0: 185.145.127.2 | /30 |\n| LAN R1 | Gi0/0: 192.168.0.1 | Gi0/1: 192.168.1.1 | /24 |\n| LAN R2 | Gi0/0: 192.168.2.1 | Gi0/1: 192.168.3.1 | /24 |\n| LAN R3 | Gi0/0: 192.168.4.1 | Gi0/1: 192.168.5.1 | /24 |',
    configs: staticConfigs,
    steps: [
      ['Monta y etiqueta', 'Coloca R1–R2–R3. Instala módulos con los routers apagados. Los nombres de puertos deben coincidir con tu modelo o adaptarse antes de pegar la configuración.', '', 'Cada enlace conecta los dos puertos de la tabla.'],
      ['Configura las interfaces', 'En cada equipo usa el bloque descargable de abajo. Si vas paso a paso, aplica primero hostname e interfaces, antes de las líneas ip route.', 'show ip interface brief\nshow controllers serial0/1/0', 'Interfaces conectadas up/up. Configura clock rate 64000 solo en el extremo DCE si proporciona el reloj.'],
      ['Configura las seis PCs', 'En cada LAN, PC .2 con máscara 255.255.255.0 y gateway .1 de su router. Por ejemplo, PC de R3: 192.168.5.2/24, gateway 192.168.5.1.', '', 'Cada PC alcanza su propio gateway.'],
      ['Agrega las rutas', 'Aplica las líneas ip route de R1, R2 y R3. La dirección final de cada ruta es la del vecino, no la del host destino.', 'show ip route', 'Aparecen rutas S hacia todas las LAN remotas; las locales siguen como C/L.'],
      ['Comprueba ida y vuelta', 'Desde 192.168.0.2 haz ping a 192.168.5.2, y luego prueba en sentido inverso. Guarda los tres equipos.', 'ping 192.168.5.2', 'Respuestas en ambos sentidos. Si falla, revisa el gateway de ambas PCs y la ruta de retorno.'],
    ],
    troubleshooting: 'Un siguiente salto debe ser alcanzable. No uses 255.255.255.8: en estas LAN la máscara correcta es /24. Los comandos show se ejecutan desde #.',
  },
  {
    id: 'rip-cuatro', number: '03', title: 'Cuatro routers que se entienden', topic: 'rip', level: 'Intermedio', minutes: 40, icon: 'network',
    goal: 'Construir el cuadrado R1–R2–R4–R3 y aprender ocho LAN mediante RIPv2.',
    needs: 'Cuatro routers 1941 con dos seriales cada uno y ocho PCs. Usa un escenario separado del de rutas estáticas para no ocultar las rutas RIP con AD 1.',
    table: '| Enlace /30 | IP y puerto de un extremo | IP y puerto del otro |\n|---|---|---|\n| 192.168.1.0 | R1 S0/0/1 = .1 | R3 S0/0/1 = .2 |\n| 192.168.1.4 | R1 S0/0/0 = .5 | R2 S0/0/0 = .6 |\n| 192.168.1.8 | R2 S0/0/1 = .9 | R4 S0/0/1 = .10 |\n| 192.168.1.12 | R3 S0/0/0 = .13 | R4 S0/0/0 = .14 |\n\nLAN /24: R1 → 7.0.0.0 y 8.0.0.0; R2 → 9.0.0.0 y 10.0.0.0; R3 → 11.0.0.0 y 12.0.0.0; R4 → 13.0.0.0 y 14.0.0.0. Gateway `.1`, PC `.2`. Se conservan rangos del ejercicio aislado; no todos son privados.',
    configs: ripConfigs,
    steps: [
      ['Conecta el cuadrado', 'Conecta cada serial según la tabla. Agrega dos LAN en Gi0/0 y Gi0/1 por router.', '', 'Los cuatro enlaces /30 no se solapan.'],
      ['Levanta las interfaces', 'Aplica el bloque de cada router. Revisa quién es DCE y configura el reloj si es necesario; ese dato depende de cómo conectaste el cable y no se adivina en las plantillas.', 'show ip interface brief\nshow controllers serial0/0/0\nshow controllers serial0/0/1', 'Todos los enlaces usados están up/up.'],
      ['Prepara las PCs', 'Usa .2 en cada LAN y .1 como gateway. Por ejemplo 8.0.0.2/24 con gateway 8.0.0.1. No uses las direcciones de red como IP de PC.', '', 'Cada PC alcanza su gateway antes de probar redes lejanas.'],
      ['Comprueba RIPv2', 'Los bloques activan version 2 y no auto-summary. network 192.168.1.0 cubre las seriales de esa red mayor. Las interfaces de PCs están pasivas para no enviarles actualizaciones.', 'show ip protocols\nshow ip route rip', 'Versión 2, auto-summary desactivado y rutas R hacia LAN remotas.'],
      ['Cruza el campus', 'Desde 8.0.0.2 prueba hacia 14.0.0.2. Espera la convergencia inicial. Si quieres experimentar, desconecta un enlace serial y observa cómo cambia la tabla tras converger.', 'ping 14.0.0.2', 'El ping funciona con las rutas de ida y regreso. Después de un fallo, RIP puede tardar en converger.'],
    ],
    troubleshooting: 'No configures 192.168.1.2 en la Gigabit de R3: en esta topología va en S0/0/1. Una ruta [120/2] tiene AD 120 y 2 saltos.',
  },
  {
    id: 'ospf-cuatro', number: '04', title: 'El mapa completo con OSPF', topic: 'ospf', level: 'Intermedio', minutes: 40, icon: 'compass',
    goal: 'Formar adyacencias OSPF área 0 entre cuatro routers y comprobar rutas O.',
    needs: 'Cuatro routers, ocho PCs, interfaces LAN /24 y enlaces seriales /30. Laboratorio nuevo, sin rutas estáticas ni RIP. Puertos seriales asignados explícitamente en esta reconstrucción.',
    table: '| Enlace | Primer extremo | Segundo extremo |\n|---|---|---|\n| R1–R2 | R1 S0/0/0: 192.168.3.1/30 | R2 S0/0/0: 192.168.3.2/30 |\n| R1–R3 | R1 S0/0/1: 200.1.0.1/30 | R3 S0/0/0: 200.1.0.2/30 |\n| R2–R4 | R2 S0/0/1: 171.127.65.1/30 | R4 S0/0/0: 171.127.65.2/30 |\n| R3–R4 | R3 S0/0/1: 185.145.120.1/30 | R4 S0/0/1: 185.145.120.2/30 |\n\nLAN por router: R1 → 192.168.1.0 y 172.16.0.0; R2 → 172.32.16.0 y 200.1.2.0; R3 → 172.32.0.0 y 195.50.50.0; R4 → 172.16.32.0 y 192.168.2.0. Todas /24, gateway `.1`, PC `.2`. Direccionamiento original para simulación aislada.',
    configs: ospfConfigs,
    steps: [
      ['Cablea con la tabla', 'Instala interfaces y conecta los cuatro enlaces. Revisa DCE con show controllers y configura clock rate solo donde corresponda.', '', 'Los vecinos físicos son R1–R2, R1–R3, R2–R4 y R3–R4.'],
      ['Aplica cada configuración', 'Los bloques contienen interfaces, process ID 1, router ID único y redes con wildcard. Cambia los puertos si tu modelo tiene otros nombres.', 'show ip interface brief', 'Interfaces up/up e IP correctas.'],
      ['Busca adyacencias', 'En los enlaces seriales punto a punto de este ejercicio, espera FULL. R1 ve a R2/R3, R2 a R1/R4, R3 a R1/R4 y R4 a R2/R3.', 'show ip ospf neighbor', 'Dos vecinos FULL por router en esta topología.'],
      ['Busca las rutas', 'Las LAN locales son C/L. Las LAN remotas aprendidas dentro del área aparecen con O.', 'show ip route ospf\nshow ip ospf interface', 'Hay rutas hacia las LAN de los otros routers con sus siguientes saltos.'],
      ['Comprueba desde una PC', 'Configura las PCs con .2/24 y gateway .1 de cada LAN. Desde la LAN 192.168.1.0 prueba hacia la PC 172.16.32.2.', 'ping 172.16.32.2', 'Conectividad entre extremos y configuraciones guardadas.'],
    ],
    troubleshooting: 'Revisa subred, área, temporizadores, autenticación y MTU si no se completa la adyacencia. El process ID no tiene que ser igual; el router ID no debe duplicarse.',
  },
  {
    id: 'campus', number: '05', title: 'Tu campus, VLAN por VLAN', topic: 'trunks', level: 'Práctica de verano', minutes: 45, icon: 'network',
    goal: 'Reconstruir una rama CORE → distribución → enlace → PC, con VLANs y administración coherentes.',
    needs: 'CORE multicapa con SVIs/routing compatibles, un switch de distribución, uno de enlace y PCs. Prueba primero Sistemas. En el mapa puedes generar los diez departamentos.',
    configs: { CORE: campusConfig(101, 'core'), DISTRIBUCION: campusConfig(101, 'distribution'), ENLACE: campusConfig(101, 'access') },
    table: '| Equipo / puerto | Conecta a | Rol |\n|---|---|---|\n| CORE Gi0/1 | Distribución Gi0/1 | Trunk |\n| Distribución Gi0/2 | Enlace Gi0/1 | Trunk |\n| Enlace Fa0/1–16 | PCs de Sistemas | Access VLAN 101 |\n| Enlace Fa0/17–18 | Equipos de voz del ejercicio | Access VLAN 23 |\n| Enlace Fa0/19 | AP-ADMON | Access VLAN 301 |\n| Enlace Fa0/24 | PC administrativa | Access VLAN 100 |\n\nSVI de administración VLAN 100: CORE 10.168.0.1, distribución .2, enlace .3; máscara /24. En un 3560 que exija seleccionar encapsulación, usa `switchport trunk encapsulation dot1q` en el puerto antes de `switchport mode trunk`. Un 2960 con solo 802.1Q no necesita ese comando.',
    steps: [
      ['Dibuja y conecta la rama', 'Usa la tabla como cableado de referencia. El PT-EMPTY de los apuntes no garantiza funciones de capa 3; para el CORE usa un modelo que sí las tenga.', '', 'Identificas uplinks, downlinks y puertos de las PCs.'],
      ['Crea las VLAN en los tres equipos', 'Aplica los bloques de abajo. Deben existir 23, 100, 101, 301 y 302 en cada switch de esta rama.', 'show vlan brief', 'VLANs activas y con nombres legibles en todos los equipos.'],
      ['Comprueba los trunks', 'El uplink de cada switch y el downlink de distribución deben ser trunks. La VLAN nativa queda en 1 en ambos extremos; VLAN 100 es administración etiquetada.', 'show interfaces trunk', 'La lista permite 23,100,101,301,302 en cada enlace de la rama.'],
      ['Administra por VLAN 100', 'Configura una PC en Fa0/24 del enlace con 10.168.0.50/24, gateway 10.168.0.1. Prueba .1, .2 y .3.', 'show ip interface brief', 'SVI VLAN 100 up/up. La PC administrativa alcanza los tres switches.'],
      ['Prueba usuarios y amplía', 'En Fa0/1 configura 10.168.101.11/24, gateway 10.168.101.1. Prueba el gateway. Para una segunda rama, usa otro puerto del CORE y otra SVI; genera el bloque del departamento en Mapa de red.', 'ping 10.168.101.1', 'Sistemas alcanza su gateway. Con otra rama correctamente configurada e ip routing, puede alcanzar su otra VLAN.'],
    ],
    troubleshooting: 'Una SVI requiere una VLAN activa con al menos un puerto en forwarding. Para diez ramas hacen falta suficientes puertos de CORE; cada trunk necesita la lista de su rama. En este ejercicio los puertos de voz son access simples, no una configuración PC+teléfono con voice vlan.',
  },
  {
    id: 'dhcp-campus', number: '06', title: 'Que las IP lleguen solitas', topic: 'dhcp', level: 'Práctica de verano', minutes: 20, icon: 'zap',
    goal: 'Asignar IP, máscara, gateway y DNS por DHCP a las PCs del campus.',
    needs: 'Completa antes la rama del campus. CORE con servicio DHCP disponible y SVI de la VLAN correspondiente up/up.',
    configs: { 'CORE · pool Sistemas': campusConfig(101, 'dhcp') },
    steps: [
      ['Valida la red antes de DHCP', 'Usa una PC con IP estática temporal para probar 10.168.101.1. Si no llega, corrige VLAN, trunk o SVI antes de seguir.', 'show ip interface brief\nshow interfaces trunk', 'La PC llega al gateway y VLAN 101 viaja por toda la rama.'],
      ['Reserva y crea el pool', 'Aplica el bloque CORE de abajo: excluye .1 a .10, declara la red /24 y entrega gateway .1.', '', 'show ip dhcp pool muestra el pool SISTEMAS.'],
      ['Pide una concesión', 'En la PC: Desktop → IP Configuration → DHCP. Espera la negociación inicial DORA.', '', 'La PC recibe una IP libre entre 10.168.101.11 y .254, máscara /24 y gateway 10.168.101.1.'],
      ['Verifica ambos lados', 'En el CORE revisa la concesión y desde la PC haz ping a su gateway.', 'show ip dhcp binding\nshow ip dhcp pool', 'La IP de la PC aparece como concesión y el ping al gateway funciona.'],
      ['Repite por departamento', 'En el mapa, cambia el departamento y elige DHCP. Cada VLAN tiene su propio pool, exclusiones y SVI. Crear un pool sin conexión L2/L3 al cliente no es suficiente.', '', 'Cada PC recibe una dirección de su propia subred, sin IPs duplicadas.'],
    ],
    troubleshooting: '169.254.x.x puede indicar autoconfiguración link-local. Revisa enlace, VLAN, SVI y pool. Si el servidor está fuera de la VLAN, necesitas relay y rutas; no es el caso de este CORE servidor local.',
  },
  {
    id: 'port-security', number: '07', title: 'Atrapa al invitado inesperado', topic: 'seguridad', level: 'Práctica de verano', minutes: 20, icon: 'shield',
    goal: 'Aprender una MAC autorizada, provocar una violación por cambio de PC y recuperar Fa0/1.',
    needs: 'La rama Sistemas funcionando, PC autorizada en Fa0/1 de ENLACE y una segunda PC con MAC distinta.',
    steps: [
      ['Protege Fa0/1', 'En el switch de enlace, activa una sola MAC sticky y modo de violación shutdown.', 'enable\nconfigure terminal\ninterface fastEthernet0/1\n switchport mode access\n switchport access vlan 101\n switchport port-security\n switchport port-security maximum 1\n switchport port-security mac-address sticky\n switchport port-security violation shutdown\n no shutdown\nend', 'Port Security está Enabled y el límite es una MAC.'],
      ['Aprende la PC correcta', 'Desde la PC autorizada solicita DHCP o haz ping a 10.168.101.1. Revisa la MAC y guarda después de aprenderla.', 'show port-security address\nshow port-security interface fa0/1\nwrite memory', 'Secure-up, una MAC Sticky y cero violaciones al iniciar.'],
      ['Cambia la PC', 'Desconecta la autorizada y conecta la segunda al mismo Fa0/1. Genera tráfico con DHCP o ping.', 'show port-security interface fa0/1\nshow interfaces fa0/1', 'Secure-shutdown, contador incrementado y err-disabled.'],
      ['Recupera el enlace', 'Retira la PC distinta y reconecta la original antes de reactivar el puerto.', 'configure terminal\ninterface fastEthernet0/1\n shutdown\n no shutdown\nend\nshow port-security interface fa0/1', 'Vuelve a Secure-up y la PC autorizada puede comunicarse.'],
      ['Documenta la evidencia', 'Anota MAC autorizada, puerto, VLAN, contador de violaciones y los estados antes/después. No copies las MAC del apunte: dependen de tus PCs.', '', 'Puedes explicar por qué falló DHCP durante la violación y qué restauró el enlace.'],
    ],
    troubleshooting: 'Si aprendió otra MAC, elimina su entrada sticky concreta en la interfaz, genera tráfico autorizado y guarda. No aumentes maximum solo para ocultar la violación del ejercicio.',
  },
  {
    id: 'limpieza', number: '08', title: 'Volver a empezar desde cero', topic: 'vlans', level: 'Preparación de examen', minutes: 10, icon: 'refresh',
    goal: 'Distinguir configuración de arranque y base de VLANs, y reiniciar el switch de laboratorio correctamente.',
    needs: 'Un switch de laboratorio que puedas vaciar o el modo de limpieza del simulador. Esta práctica elimina la configuración del equipo seleccionado.',
    steps: [
      ['Inspecciona lo que existe', 'Observa la configuración y las VLAN antes de borrar. Si necesitas conservarlas, copia su contenido fuera del equipo.', 'enable\nshow startup-config\nshow vlan brief', 'Identificas qué datos vas a retirar.'],
      ['Borra startup-config', 'Desde EXEC privilegiado, ejecuta el comando y confirma cuando se solicite. La configuración activa todavía permanece en RAM.', 'erase startup-config', 'El archivo de arranque queda borrado; running-config todavía puede contener datos.'],
      ['Borra la base de VLANs', 'En estos switches, vlan.dat puede sobrevivir al borrado de startup-config. Acepta la confirmación del nombre y del borrado; la ruta varía según plataforma.', 'delete flash:vlan.dat', 'Se elimina la base persistente de VLANs del laboratorio.'],
      ['Reinicia sin volver a guardar', 'Ejecuta reload. Si pregunta si quieres guardar la configuración modificada, responde no. Confirma el reinicio; si aparece el diálogo de configuración inicial, responde no.', 'reload', 'Tras arrancar, no vuelve la configuración antigua.'],
      ['Comprueba el resultado', 'Entra de nuevo a privilegiado y revisa. Las VLAN por defecto/reservadas pueden seguir apareciendo; eso es normal.', 'enable\nshow vlan brief\nshow startup-config', 'No quedan las VLAN de usuario ni la configuración de arranque anterior.'],
    ],
    troubleshooting: 'No uses write memory después de erase y antes de reload: volverías a guardar la configuración activa que querías eliminar.',
  },
];
