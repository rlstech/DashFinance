FROM python:3.11-slim
RUN pip install --no-cache-dir websockets
COPY proxy.py /proxy.py
CMD ["python", "/proxy.py"]
