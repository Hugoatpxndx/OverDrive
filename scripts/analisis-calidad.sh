#!/usr/bin/env bash
# ============================================================
# OverDrive · Análisis de calidad con SonarQube (local, Docker)
#
# Levanta SonarQube, genera el token de análisis, corre las
# pruebas con cobertura y ejecuta el escáner de Sonar.
#
# Requisitos: Docker + Docker Compose.
# Resultado: http://localhost:9000/dashboard?id=overdrive
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

SONAR_URL="http://localhost:9000"
ADMIN_PASS="Overdrive2026!"

echo ">> Levantando SonarQube..."
docker compose -f compose.sonar.yaml up -d

echo ">> Esperando a que SonarQube esté listo (puede tardar 1-2 min)..."
for _ in $(seq 1 120); do
  status=$(curl -s "$SONAR_URL/api/system/status" | grep -o '"status":"[A-Z]*"' | cut -d'"' -f4 || true)
  [ "$status" = "UP" ] && break
  sleep 5
done

if [ "${status:-}" != "UP" ]; then
  echo "!! SonarQube no respondió a tiempo. Revisa: docker logs overdrive-sonarqube"
  exit 1
fi
echo ">> SonarQube listo."

echo ">> Configurando credenciales de admin (solo la primera vez)..."
curl -s -u admin:admin -X POST "$SONAR_URL/api/users/change_password" \
  --data-urlencode "login=admin" \
  --data-urlencode "password=$ADMIN_PASS" \
  --data-urlencode "previousPassword=admin" >/dev/null || true

echo ">> Generando token de análisis..."
TOKEN=$(curl -s -u "admin:$ADMIN_PASS" -X POST "$SONAR_URL/api/user_tokens/generate" \
  --data-urlencode "name=scanner-$(date +%s)" \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "!! No se pudo generar el token. ¿Cambió la contraseña de admin?"
  exit 1
fi

echo ">> Ejecutando pruebas del backend con cobertura..."
(cd backend && npm test)

echo ">> Ejecutando escáner de SonarQube..."
docker run --rm --network host \
  -u "$(id -u):$(id -g)" \
  -e SONAR_HOST_URL="$SONAR_URL" \
  -e SONAR_TOKEN="$TOKEN" \
  -e SONAR_USER_HOME=/tmp/.sonar \
  -v "$PWD:/usr/src" \
  sonarsource/sonar-scanner-cli

echo ""
echo "============================================================"
echo " Análisis completado."
echo " Dashboard: $SONAR_URL/dashboard?id=overdrive"
echo " Usuario:   admin / $ADMIN_PASS"
echo "============================================================"
