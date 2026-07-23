# Plan de cobertura para la Red Comunitaria Nutria

## Antes de comprar o configurar

1. Confirma por escrito que el contrato del proveedor permite compartir el servicio fuera del domicilio.
2. Define responsables, presupuesto, pol?tica de privacidad y canal para reportar abuso.
3. Haz un levantamiento de se?al y l?nea de vista; no prometas cobertura de toda la colonia sin mediciones.
4. Separa completamente la red privada de la red de invitados mediante VLAN, subred, firewall y aislamiento entre clientes.
5. Consulta a un instalador sobre puesta a tierra, protecci?n contra descargas, sellado exterior y l?mites regulatorios de potencia radiada.

## Dise?o recomendado

- Router principal en un punto ventilado, elevado y central, conectado a UPS.
- Backhaul por Ethernet o fibra siempre que sea posible. Cada salto inal?mbrico comparte espectro y reduce capacidad.
- Puntos de acceso exteriores con clasificaci?n para intemperie, montaje profesional y alimentaci?n PoE protegida.
- 5 GHz/6 GHz para enlaces de alta capacidad y l?nea de vista; 2.4 GHz para alcance y compatibilidad, con canales no solapados.
- Antenas omnidireccionales para usuarios alrededor del nodo; direccionales solo para enlaces punto a punto correctamente alineados.
- No elegir ?15 dBi o m?s? autom?ticamente: m?s ganancia estrecha el patr?n y puede exceder l?mites de EIRP.

## Materiales

- Router compatible con la versi?n actual de OpenWrt y con memoria suficiente.
- Dos o m?s puntos de acceso compatibles con 802.11s o backhaul cableado.
- Switch PoE administrable con VLAN.
- Cable exterior certificado, conectores, cajas estancas y herrajes.
- UPS, protecci?n contra sobretensi?n Ethernet y puesta a tierra profesional.
- Etiquetas, plano de nodos y repuestos.

## OpenWrt y mesh

1. Busca el modelo y **revisi?n exacta de hardware** en la tabla de dispositivos y Firmware Selector de OpenWrt.
2. Descarga solo la imagen indicada, verifica checksum y conserva firmware/configuraci?n de recuperaci?n.
3. Conecta por cable durante la instalaci?n. Una imagen incorrecta puede inutilizar el router.
4. Verifica soporte del controlador con `iw list`; debe mostrar `mesh point`.
5. Configura todos los nodos con el mismo `mesh_id`, canal y cifrado SAE. Usa una clave robusta distinta de la red p?blica.
6. Comprueba enlaces con `iw dev mesh0 station dump` y prueba cada nodo antes de montarlo.

La configuraci?n exacta cambia por versi?n y chipset; sigue la documentaci?n vigente del dispositivo en vez de copiar comandos gen?ricos.

## Portal cautivo

Usa **openNDS** en versiones actuales de OpenWrt. No uses ChilliSpot o tutoriales antiguos sin verificar compatibilidad con firewall4/nftables.

El portal debe:

- Mostrar ?Conectar gratis?, t?rminos, privacidad y datos de contacto.
- No pedir contrase?as innecesarias.
- Mantener CHONGSEB como enlace opcional; no fuerces redirecciones HTTPS.
- Bloquear acceso de invitados a LAN, panel del router y otros clientes.
- Indicar que el portal no cifra el tr?fico: los usuarios deben preferir sitios HTTPS.

## Capacidad

Mide carga real y configura SQM/CAKE en el enlace WAN ligeramente por debajo de la velocidad estable. CAKE ofrece reparto por host; `qos.sh` es un prototipo de l?mite de descarga para IPs conocidas, no reemplaza un dise?o QoS completo.

Empieza con un piloto de un nodo y pocos vecinos. Documenta se?al, latencia, consumo, temperatura, cortes y quejas antes de ampliar.
