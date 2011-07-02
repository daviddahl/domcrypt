from django.conf.urls.defaults import *
import os

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()

urlpatterns = patterns('bcast.server.views',
                       (r'^bcast/$', 'index'),
                       (r'^bcast/create/account/$', 'create_account'),
                       (r'^bcast/destroy/account/$', 'destroy_account'),
                       (r'^bcast/_xhr/check/display/name/$', 'x_check_display_name'),
                       (r'^bcast/_xhr/create/acct/$', 'x_create_acct'),
                       (r'^bcast/_xhr/destroy/acct/$', 'x_destroy_acct'),
                       (r'^bcast/_xhr/post/msg/$', 'x_post_msg'),
                       (r'^bcast/_xhr/remove/msg/$', 'x_remove_msg'),
                       (r'^bcast/_xhr/search/accounts/$', 'x_search_accts'),
                       (r'^bcast/_xhr/follow/$', 'x_follow'),
                       (r'^bcast/_xhr/block/$', 'x_block'),
                       (r'^bcast/_xhr/get/followers/$', 'x_get_followers'),
                       (r'^bcast/_xhr/fetch/console/msgs/$', 'x_fetch_console'),
                       (r'^admin/doc/', include('django.contrib.admindocs.urls')),
                       (r'^admin/', include(admin.site.urls)),
                       )

urlpatterns += patterns('',
                        (r'^site_media/(.*)$',
                         'django.views.static.serve',
                         {'document_root': os.environ.get('BCAST_MEDIA_ROOT',
                                                          '/home/ddahl/code/domcrypt/demos/broadcast/bcast/site_media/'),
                          'show_indexes': False}),
                        )
