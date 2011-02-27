urlpatterns = patterns('dcserver.msgdrp.views',
                       (r'^/$', 'index'),
                       (r'^fetch/', 'fetch'),
                       (r'^messages/', 'messages'),
                       (r'^compose/', 'compose'),
                       (r'^send/', 'send')
                       )
