FROM httpd:2.4

# Enable mod_status for the Apache receiver to scrape metrics
RUN sed -i \
    -e 's/#LoadModule status_module/LoadModule status_module/' \
    /usr/local/apache2/conf/httpd.conf

# Add server-status location accessible from within the Docker network
RUN echo '\n\
ExtendedStatus On\n\
<Location /server-status>\n\
    SetHandler server-status\n\
    Require ip 127.0.0.1 172.16.0.0/12 10.0.0.0/8 192.168.0.0/16\n\
</Location>\n' >> /usr/local/apache2/conf/httpd.conf
