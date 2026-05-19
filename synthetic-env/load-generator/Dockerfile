FROM grafana/k6:latest
COPY script.js /scripts/script.js
ENTRYPOINT ["k6", "run", "/scripts/script.js"]
