server {
    listen {{PORT}};
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Lightweight health probe
    location = /health {
        access_log off;
        default_type text/plain;
        return 200 "ok\n";
    }
}
