from django.contrib import admin
from bcast.server.models import TimelineMessage, Account, Followers

admin.site.register(TimelineMessage)
admin.site.register(Account)
admin.site.register(Followers)
