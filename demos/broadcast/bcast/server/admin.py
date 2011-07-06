from django.contrib import admin
from bcast.server.models import TimelineMessage, Account, Follower

admin.site.register(TimelineMessage)
admin.site.register(Account)
admin.site.register(Follower)
