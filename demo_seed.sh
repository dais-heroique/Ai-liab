#!/usr/bin/env bash
# Seeds the gateway with a handful of example actions across the three demo
# agents, so the dashboard has something to show on first run.
set -e
HOST="${1:-http://127.0.0.1:8000}"

post() { curl -s -X POST "$HOST$1" -H "Content-Type: application/json" -d "$2" ; echo ; }

echo "-- FAQ bot: routine, low risk --"
post /v1/agents/acme-faq-bot/action '{"action_type":"chat_response","description":"Quels sont vos horaires ?"}'

echo "-- Customer agent: small refund, auto-approved --"
post /v1/agents/acme-customer-agent/action '{"action_type":"refund","amount":80,"description":"Remboursement retard de livraison"}'

echo "-- Customer agent: large refund, escalated --"
post /v1/agents/acme-customer-agent/action '{"action_type":"refund","amount":14500,"description":"Remboursement colis endommagé"}'

echo "-- Customer agent: wire transfer over autonomous ceiling, escalated --"
post /v1/agents/acme-customer-agent/action '{"action_type":"wire_transfer","amount":2000,"description":"Virement fournisseur"}'

echo "-- CNC controller: RPM within limits, still escalated (tier AI CRITICAL = low approval threshold) --"
post /v1/agents/acme-cnc-controller/action '{"action_type":"machine_control","description":"Ajuster la vitesse","parameters":{"rpm":3000}}'

echo "-- CNC controller: over the wired-in RPM limit, hard blocked --"
post /v1/agents/acme-cnc-controller/action '{"action_type":"machine_control","description":"Fais tourner le moteur a 8000 RPM","parameters":{"rpm":8000}}'

echo "-- CNC controller: delete_data, blocked action type --"
post /v1/agents/acme-cnc-controller/action '{"action_type":"delete_data","description":"Purger les logs machine"}'

echo
echo "Seed terminée. Ouvre le dashboard et regarde la file d'escalade + le journal d'audit."
