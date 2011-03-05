from datetime import datetime
import hashlib
import random

from django.db import models

class Message(models.Model):
    """
    A Secure message
    """
    _hash = models.CharField(max_length=255)
    date_time = models.DateTimeField(auto_now_add=True)
    content = models.TextField(null=True,blank=True)
    fetched = models.BooleanField(default=False)
    
    def __unicode__(self):
        return u"To: %s" % (self._hash,)

class Addressbook(models.Model):
    """
    The server/domain addressbook. 
    The addressbook provides the back end data to views where a 
    user's Addressbook entry is displayed
    """
    handle = models.CharField(max_length=255, unique=True)
    _hash = models.CharField(max_length=255, unique=True)
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True, auto_now_add=True)
    service_key = models.CharField(max_length=255)
    pub_key = models.TextField()
    domain = models.CharField(max_length=255)
    
    def __unicode__(self):
        return u"%s" % (self.handle,)

def generate_service_key(_hash):
    """
    Generate a service key that a user needs to fetch and send messages
    """
    # hash the hash + a date_time string
    rndm = random.randint(0, 1000000)
    seed = "%s-%s-%s" % (_hash, 
                         str(datetime.now()), 
                         str(rndm),) 
    hashed = hashlib.sha256(seed).hexdigest()
    return hashed
