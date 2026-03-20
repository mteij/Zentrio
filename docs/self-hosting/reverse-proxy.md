# Reverse Proxy

If your instance will be reachable outside your local network, put it behind a reverse proxy and serve it over HTTPS.

## Basic Requirements

- Your public URL should match `APP_URL`
- The proxy should forward `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto`
- WebSocket upgrades should be passed through

## Nginx

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

## Caddy

```txt
zentrio.example.com {
    reverse_proxy localhost:3000
}
```

## Recommended Follow-Up

After the proxy is in place, verify sign-in flows, callback URLs, and any email links against the final public domain.
