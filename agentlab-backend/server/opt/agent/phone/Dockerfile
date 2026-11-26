FROM agentlab-phone:base
WORKDIR /app
COPY worker /app/worker
COPY provision.py /app/provision.py
CMD ["python","-u","-m","worker.main","start"]
