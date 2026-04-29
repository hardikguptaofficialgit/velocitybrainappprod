# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

ARG REACT_APP_API_URL=
ARG REACT_APP_FIREBASE_API_KEY=
ARG REACT_APP_FIREBASE_AUTH_DOMAIN=
ARG REACT_APP_FIREBASE_PROJECT_ID=
ARG REACT_APP_FIREBASE_STORAGE_BUCKET=
ARG REACT_APP_FIREBASE_MESSAGING_SENDER_ID=
ARG REACT_APP_FIREBASE_APP_ID=
ARG REACT_APP_FIREBASE_MEASUREMENT_ID=
ARG REACT_APP_REVENUECAT_API_KEY=

ENV REACT_APP_API_URL=$REACT_APP_API_URL \
    REACT_APP_FIREBASE_API_KEY=$REACT_APP_FIREBASE_API_KEY \
    REACT_APP_FIREBASE_AUTH_DOMAIN=$REACT_APP_FIREBASE_AUTH_DOMAIN \
    REACT_APP_FIREBASE_PROJECT_ID=$REACT_APP_FIREBASE_PROJECT_ID \
    REACT_APP_FIREBASE_STORAGE_BUCKET=$REACT_APP_FIREBASE_STORAGE_BUCKET \
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID=$REACT_APP_FIREBASE_MESSAGING_SENDER_ID \
    REACT_APP_FIREBASE_APP_ID=$REACT_APP_FIREBASE_APP_ID \
    REACT_APP_FIREBASE_MEASUREMENT_ID=$REACT_APP_FIREBASE_MEASUREMENT_ID \
    REACT_APP_REVENUECAT_API_KEY=$REACT_APP_REVENUECAT_API_KEY

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx config
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
    location /api { \
        proxy_pass http://backend:5001; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
