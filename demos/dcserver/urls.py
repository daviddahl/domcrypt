import os
from django.conf.urls.defaults import *

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()

urlpatterns = patterns('dcserver.msgdrp.views',
                       (r'^$', 'index'),
                       (r'^fetch/', 'fetch'),
                       (r'^messages/', 'messages'),
                       (r'^compose/', 'compose'),
                       (r'^send/', 'send'),
    # Uncomment the next line to enable the admin:
    (r'^admin/', include(admin.site.urls)),
)

urlpatterns += patterns('',
                        (r'^site_media/(.*)$',
                         'django.views.static.serve',
                         {'document_root': os.environ.get('DC_MEDIA_ROOT',
                                                          '/home/ddahl/code/domcrypt/demos/dcserver/site_media/'),
                          'show_indexes': False}),
                        )
