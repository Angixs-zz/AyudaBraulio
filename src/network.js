export function calculateSubnet(value) {
  const match = String(value).trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if (!match) throw new Error('Escribe una IPv4 con prefijo, por ejemplo 192.168.1.6/30.');
  const octets = match.slice(1, 5).map(Number);
  const prefix = Number(match[5]);
  if (octets.some(n => n > 255) || prefix > 32) throw new Error('Cada octeto debe estar entre 0 y 255, y el prefijo entre /0 y /32.');
  const ip = octets.reduce((n, octet) => n * 256 + octet, 0);
  const size = 2 ** (32 - prefix);
  const network = Math.floor(ip / size) * size;
  const last = network + size - 1;
  const format = n => [24, 16, 8, 0].map(shift => (n >>> shift) & 255).join('.');
  return {
    network: format(network), mask: format(2 ** 32 - size), wildcard: format(size - 1),
    broadcast: prefix < 31 ? format(last) : 'No aplica',
    first: format(prefix < 31 ? network + 1 : network),
    last: format(prefix < 31 ? last - 1 : last),
    hosts: prefix < 31 ? size - 2 : size, prefix,
    note: prefix === 31 ? '/31: dos extremos de un enlace punto a punto (RFC 3021).' : prefix === 32 ? '/32: una dirección individual o ruta de host.' : `Bloques de ${size.toLocaleString('es-MX')} direcciones; red y broadcast se reservan.`,
  };
}

export const departments = ['Sistemas', 'Electrónica', 'CEA', 'Dirección', 'Escolares', 'Civil', 'Química', 'Industrial', 'Contabilidad', 'Eléctrica'].map((name, index) => ({
  name, vlan: 101 + index, key: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(),
  distribution: `10.168.0.${2 + index * 2}`, access: `10.168.0.${3 + index * 2}`,
}));

export function campusConfig(vlan, role = 'access') {
  const d = departments.find(item => item.vlan === Number(vlan));
  if (!d || !['access', 'distribution', 'core', 'dhcp'].includes(role)) throw new Error('Departamento o equipo desconocido.');
  const vlans = [[23, 'VOZ'], [100, 'ADMINISTRATIVA'], [d.vlan, d.key], [301, 'AP-ADMON'], [302, 'INALAMBRICA']];
  const create = vlans.map(([id, name]) => `vlan ${id}\n name ${name}\nexit`).join('\n');
  const trunk = port => `interface ${port}\n switchport mode trunk\n switchport trunk native vlan 1\n switchport trunk allowed vlan 23,100,${d.vlan},301,302\n no shutdown\nexit`;
  const svi = (id, ip) => `interface vlan ${id}\n ip address ${ip} 255.255.255.0\n no shutdown\nexit`;
  const ports = (range, id) => `interface ${range}\n switchport mode access\n switchport access vlan ${id}\n no shutdown\nexit`;
  let body;
  if (role === 'dhcp') body = `ip dhcp excluded-address 10.168.${d.vlan}.1 10.168.${d.vlan}.10\nip dhcp pool ${d.key}\n network 10.168.${d.vlan}.0 255.255.255.0\n default-router 10.168.${d.vlan}.1\n dns-server 8.8.8.8\nexit`;
  else if (role === 'core') body = `hostname CORE\n${create}\nip routing\n${trunk('gigabitEthernet0/1')}\n${svi(100, '10.168.0.1')}\n${svi(d.vlan, `10.168.${d.vlan}.1`)}`;
  else body = `hostname ${d.key}-${role === 'access' ? 'ENLACE' : 'DIST'}\n${create}\n${trunk('gigabitEthernet0/1')}\n${role === 'distribution' ? trunk('gigabitEthernet0/2') + '\n' : ''}${svi(100, d[role])}\nip default-gateway 10.168.0.1${role === 'access' ? '\n' + [ports('range fastEthernet0/1 - 16', d.vlan), ports('range fastEthernet0/17 - 18', 23), ports('fastEthernet0/19', 301), ports('fastEthernet0/24', 100)].join('\n') : ''}`;
  return `enable\nconfigure terminal\n${body}\nend\nwrite memory`;
}

export function packetJourney(destination, routing) {
  if (destination === 'same') return { success: true, title: '¡Llegó dentro de la VLAN 101!', text: 'El switch consulta la MAC destino y conmuta la trama. La PC no necesita pasar por el gateway para hablar con otra IP de su subred.', path: 'local' };
  if (routing) return { success: true, title: '¡Llegó a la VLAN 102!', text: 'La PC envía la trama a la MAC de su gateway. El CORE enruta el paquete IP entre sus SVIs y construye una nueva trama para la VLAN 102. El trunk transporta las VLAN; no hace el enrutamiento.', path: 'routed' };
  return { success: false, title: 'Falta el paso de capa 3', text: 'Un trunk transporta varias VLAN, pero las mantiene separadas. Activa el enrutamiento y usa una SVI/gateway por VLAN en un switch multicapa. Suponemos IPs, gateways y enlaces correctos.', path: 'blocked' };
}
