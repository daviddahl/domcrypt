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
