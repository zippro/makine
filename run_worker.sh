#!/bin/bash
while true; do
  echo "Starting worker..." >> worker.log
  node scripts/local_ffmpeg_worker.js >> worker.log 2>&1
  echo "Worker crashed or exited. Restarting in 5s..." >> worker.log
  sleep 5
done
