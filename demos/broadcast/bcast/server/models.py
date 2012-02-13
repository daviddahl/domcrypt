from django.db import models

from datetime import datetime
import hashlib
import random

class TimelineMessage(models.Model):
    """
    timeline messages
    
    """
    recipient = models.ForeignKey('server.Account', related_name="recipient")
    author = models.ForeignKey('server.Account', related_name="author")
    author_display_name = models.CharField(max_length=255, null=True, blank=True)
    date_time = models.DateTimeField(auto_now_add=True)
    content = models.TextField(null=False, blank=False)
    wrapped_key = models.TextField(null=False, blank=False)
    iv = models.CharField(max_length=255)
    fetched = models.BooleanField(default=False)
    parent_message_id = models.IntegerField(null=True, blank=True)
    
    def __unicode__(self):
        return u"To: %s" % (self.recipient,)

    def save(self, *args, **kwargs):
        resave = False
        self.author_display_name = self.author.display_name
        if self.parent_message_id:
            super(TimelineMessage, self).save(*args, **kwargs)
            return
        if not self.id:
            resave = True
        super(TimelineMessage, self).save(*args, **kwargs)
        if resave:
            self.parent_message_id = self.id
            super(TimelineMessage, self).save(*args, **kwargs)
        

class Account(models.Model):
    identifier = models.CharField(unique=True, max_length=255)
    login_token = models.CharField(max_length=255)
    bio = models.TextField(null=True)
    url = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255)
    ctime = models.DateTimeField(auto_now_add=True)
    pub_key = models.TextField(null=True)

    def __unicode__(self):
        return u"%s" % (self.display_name,)

    def save(self, *args, **kwargs):
        if not self.id:
            # create identifier
            token = "%s-%s" % (self.display_name, str(datetime.now()))
            self.identifier = hashlib.sha256(token).hexdigest()

        super(Account, self).save(*args, **kwargs) 

class Hierarchy(models.Model):
    leader = models.ForeignKey('server.Account', related_name="leader")
    follower = models.ForeignKey('server.Account', related_name="follower")
    ctime = models.DateTimeField(auto_now_add=True)
    approved = models.BooleanField(default=True)
    atime = models.DateTimeField(auto_now_add=True)
    blocked = models.BooleanField(default=False)
    btime = models.DateTimeField(auto_now_add=False, null=True, blank=True)
    # TODO: need to add an approved boolean and date as well as a 
    # blocked boolean and date 

    def __unicode__(self):
        return u"%s is following %s" % (self.follower, self.leader,)
