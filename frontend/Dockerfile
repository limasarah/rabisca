FROM nginx:stable-alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["/bin/sh", "-c", "exec nginx -g 'daemon off;'"]
