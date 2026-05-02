# ZaoDirect Deployment (Vercel Frontend + EC2 Backend)

## 1. What This Setup Does
- `Vercel` hosts the React frontend.
- `EC2` runs the Node backend with `PM2`.
- `Nginx` on EC2 exposes `https://api.zaodirect.com` and proxies to backend port `4001`.
- `RDS PostgreSQL` stores production data.

## 2. Backend Environment (EC2)
Copy `backend/.env.production.example` to `backend/.env` and fill real values.

Minimum required:
- `PORT=4001`
- `NODE_ENV=production`
- `JWT_SECRET=<strong-random-secret>`
- `DATABASE_URL=<rds-postgres-url>`
- `FRONTEND_URL=https://zaodirect.com,https://www.zaodirect.com,https://zaodirect.vercel.app`

## 3. Install Runtime On EC2
```bash
sudo apt update
sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

## 4. Start Backend With PM2
From project root on EC2:
```bash
cd backend
npm install
npm run db:migrate:mvp-operations
npm run db:migrate:shipment-events
npm run db:migrate:audit-events
npm run db:migrate:dispute-cases
npm run db:migrate:batch-shipment-lots
npm run db:migrate:intl-order-statuses
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 5. Nginx Reverse Proxy
Create `/etc/nginx/sites-available/zaodirect-api`:
```nginx
server {
  listen 80;
  server_name api.zaodirect.com;

  location / {
    proxy_pass http://127.0.0.1:4001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/zaodirect-api /etc/nginx/sites-enabled/zaodirect-api
sudo nginx -t
sudo systemctl reload nginx
```

## 6. TLS Certificate
After DNS for `api.zaodirect.com` points to EC2 public IP:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.zaodirect.com
```

## 7. Frontend On Vercel
- Connect `frontend` project to Vercel.
- Set env:
  - `REACT_APP_API_URL=https://api.zaodirect.com`
- Deploy.

## 8. Smoke Test After Deploy
- `GET https://api.zaodirect.com/api/health` should return `{ ok: true, ... }`
- Login from frontend.
- Create one international order.
- Create one procurement order.
- Open batch page and confirm data loads.

## 9. Basic Operations
- Restart backend: `pm2 restart zaodirect-backend`
- View logs: `pm2 logs zaodirect-backend --lines 200`
- Check process: `pm2 status`
- Check nginx: `sudo systemctl status nginx`
