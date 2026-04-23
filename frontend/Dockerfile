FROM nginx:1.27-alpine

ARG STRIPE_PUBLISHABLE_KEY=

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html

RUN find /usr/share/nginx/html -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' \) -exec sed -i "s/__STRIPE_PUBLISHABLE_KEY__/${STRIPE_PUBLISHABLE_KEY}/g" {} +

EXPOSE 80
