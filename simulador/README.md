# Simulador Cisco 2960 · VLAN

Aplicación web estática para practicar el examen de configuración de un switch Cisco 2960 desde una consola estilo PuTTY.

## Funciones

- Escenarios por departamento: Sistemas, Electrónica, Civil, Eléctrica, Mecánica, Química, Industrial, Gestión y Administración.
- Modos guiado, examen y laboratorio libre.
- Consola con modos IOS: usuario, privilegiado, configuración global, VLAN, interfaz y línea.
- Creación y eliminación de VLAN.
- Puertos access por rangos.
- Trunk `Gi0/1`, VLAN nativa y lista de VLAN permitidas.
- IP de administración en `interface vlan 1` y gateway predeterminado.
- Comandos de verificación: `show vlan brief`, `show interfaces trunk`, `show running-config`.
- Guardado con `wr`, `write memory` o `copy running-config startup-config`.
- Práctica completa de limpieza: `erase startup-config`, `delete flash:vlan.dat`, `reload` y confirmaciones.
- Diseño adaptable a teléfono y computadora.
- PWA: después de la primera carga puede funcionar sin conexión en navegadores compatibles.

## Abrir localmente

Puedes abrir `index.html` directamente. Para probar el modo instalable/PWA, conviene servir la carpeta con un servidor local:

```bash
python3 -m http.server 8080
```

Luego abre `http://localhost:8080`.

## Publicar en GitHub Pages

1. Crea un repositorio y sube todos los archivos de esta carpeta a la raíz.
2. En la configuración de Pages, selecciona publicación desde una rama.
3. Elige la rama principal y la carpeta `/(root)`.
4. Guarda y espera a que GitHub publique la dirección del sitio.

El proyecto no necesita base de datos, npm ni proceso de compilación.

## Personalizar datos

Los departamentos, VLAN e IP de administración están al inicio de `app.js`, en las constantes `DEPARTMENTS` y `COMMON_VLANS`.

## Comandos principales aceptados

```text
enable
configure terminal
hostname INDUSTRIAL
enable secret 12345
line console 0
password 12345
login
line vty 0 15
service password-encryption
banner motd #Personal autorizado#
vlan 116
name INDUSTRIAL
no vlan 116
interface range fa0/1-16
switchport mode access
switchport access vlan 116
interface gi0/1
switchport mode trunk
switchport trunk native vlan 1
switchport trunk allowed vlan 1,116,119,120,121
interface vlan 1
ip address 200.1.2.9 255.255.255.0
ip default-gateway 200.1.2.1
show vlan brief
show interfaces trunk
show running-config
write memory
erase startup-config
delete flash:vlan.dat
reload
```

## Alcance

Es un simulador educativo enfocado en los comandos vistos en la práctica y el examen. No pretende emular todo Cisco IOS.
