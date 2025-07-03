# Use official Python image
FROM python:3.11-slim

# Set work directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .
COPY secrets/fantacalcio-project-0191a57d85d2.json /secrets/firestore-access-key.json

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code
COPY . ./backend

# Expose port (FastAPI/Flask default)
EXPOSE 8080

# Start the app (adjust if you use Flask)
CMD ["gunicorn", "-b", "0.0.0.0:8080", "backend.api.app:create_app()"]