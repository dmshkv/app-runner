set -euo pipefail

LOGFILE=$HOME/logs/build-$(date +%F-%H%M%S).log

echo "Welcome to the world of safe build" | tee -a "$LOGFILE"

# Clean up unused containers, images, volumes
docker system prune -af --volumes | tee -a "$LOGFILE"

# Run compose build with throttling
nohup sudo nice -n 10 ionice -c2 -n7 \
  env COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=1 BUILDKIT_MAX_PARALLELISM=1 \
  docker compose build --progress=plain \
  >> "$LOGFILE" 2>&1 &

BUILD_PID=$!
echo "Build started in background (PID: $BUILD_PID)" | tee -a "$LOGFILE"
echo "Logs: $LOGFILE" | tee -a "$LOGFILE"

# Wait for the build to finish
wait $BUILD_PID

echo "Build completed at $(date)" | tee -a "$LOGFILE"

# Start containers
docker compose up -d | tee -a "$LOGFILE"

echo "Services are up at $(date)" | tee -a "$LOGFILE"