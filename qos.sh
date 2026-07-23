#!/bin/sh
set -eu

# Prototipo OpenWrt/Linux: limita la descarga hacia IPs invitadas conocidas.
# No configura subida WAN, portal cautivo, DHCP ni firewall.
GUEST_IF="${GUEST_IF:-br-guest}"
GUEST_RATE="${GUEST_RATE:-5mbit}"
TOTAL_RATE="${TOTAL_RATE:-100mbit}"
ADMIN_IP="${ADMIN_IP:-}"
GUEST_IPS="${GUEST_IPS:-}"
APPLY="${APPLY:-0}"

command -v tc >/dev/null 2>&1 || { echo "Falta tc/iproute2."; exit 1; }
[ -n "$GUEST_IPS" ] || { echo "Define GUEST_IPS, por ejemplo 192.168.50.20,192.168.50.21"; exit 1; }
ip link show "$GUEST_IF" >/dev/null 2>&1 || { echo "Interfaz inexistente: $GUEST_IF"; exit 1; }

run() {
  printf '%s\n' "$*"
  [ "$APPLY" = "1" ] && "$@"
}

echo "Plan QoS: interfaz=$GUEST_IF total=$TOTAL_RATE limite_por_IP=$GUEST_RATE"
echo "Modo seguro: usa APPLY=1 ?nicamente despu?s de revisar la salida."
run tc qdisc del dev "$GUEST_IF" root
run tc qdisc add dev "$GUEST_IF" root handle 1: htb default 999
run tc class add dev "$GUEST_IF" parent 1: classid 1:1 htb rate "$TOTAL_RATE" ceil "$TOTAL_RATE"
run tc class add dev "$GUEST_IF" parent 1:1 classid 1:999 htb rate 1mbit ceil "$GUEST_RATE"
run tc qdisc add dev "$GUEST_IF" parent 1:999 handle 999: fq_codel

class=10
old_ifs="$IFS"; IFS=","
for address in $GUEST_IPS; do
  IFS="$old_ifs"
  ip route get "$address" >/dev/null 2>&1 || { echo "IP inv?lida o no enrutable: $address"; exit 1; }
  run tc class add dev "$GUEST_IF" parent 1:1 classid "1:$class" htb rate "$GUEST_RATE" ceil "$GUEST_RATE"
  run tc qdisc add dev "$GUEST_IF" parent "1:$class" handle "$class:" fq_codel
  run tc filter add dev "$GUEST_IF" protocol ip parent 1: prio 20 u32 match ip dst "$address"/32 flowid "1:$class"
  class=$((class + 1))
  IFS=","
done
IFS="$old_ifs"

if [ -n "$ADMIN_IP" ]; then
  run tc class add dev "$GUEST_IF" parent 1:1 classid 1:2 htb rate 10mbit ceil "$TOTAL_RATE" prio 0
  run tc qdisc add dev "$GUEST_IF" parent 1:2 handle 2: fq_codel
  run tc filter add dev "$GUEST_IF" protocol ip parent 1: prio 1 u32 match ip dst "$ADMIN_IP"/32 flowid 1:2
fi

echo "Listo. Para revertir: tc qdisc del dev $GUEST_IF root"
