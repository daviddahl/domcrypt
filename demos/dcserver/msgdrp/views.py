from django.http import Http404, HttpResponse, HttpResponseRedirect
from django.template import Context, loader
from django.shortcuts import render_to_response, get_object_or_404
from django import forms
from django.utils import simplejson
from django.utils.translation import ugettext_lazy as _
from django.contrib.syndication import feeds
from django.http import Http404
from django.views.decorators.csrf import csrf_protect
from django.template import RequestContext

from dcserver.msgdrp.models import *

from django.core.serializers import serialize
from django.db.models.query import QuerySet

class JsonResponse(HttpResponse):
    content = None

    def __init__(self, object):
        if isinstance(object, QuerySet):
            content = serialize('json', object)
        else:
            content = simplejson.dumps(object)
        self.content = simplejson.loads(content)
        super(JsonResponse, self).__init__(content, mimetype='application/json')

def index(request):
    """
    an index page with links to the extension, messages pages and compose page
    """
    return render_to_response("index.html", {})

def fetch(request):
    """
    pull up all messages delivered to request.GET[h] (hash)
    """
    try:
        if request.GET['h'] is None:
            raise Exception("No messages for %s" % request.GET['h'])
        messages = Message.objects.filter(_hash=request.GET['h'])
        _msgs = []
        for message in messages:
            _msgs.append({'hash':message._hash, 
                          'content':message.content, 
                          'dateTime':message.date_time})
            message.fetched = True
            message.save()
        msg = { 'status': 'success', 'msg': _msgs }
 
    except Exception, e:
        msg = {'status': 'failure', 'msg': e}

    return JsonResponse(msg);

def messages(request):
    """
    Read messages 
    """
    return render_to_response("messages.html", {})

def compose(request):
    """
    Compose a message page
    """
    return render_to_response("compose.html", {}, context_instance=RequestContext(request))

def send(request):
    """
    Send the message 
    """

    try:
        if request.POST['message'] and request.POST['_hash']:
            """the message will just be a JSON string to be stored lin the database"""
            message = Message(_hash=request.POST['_hash'], content=request.POST['message'])
            message.save()
            msg = {'status': 'success', 'msg': "Message sent"}

    except Exception, e:
        print e
        msg = {'status': 'failure', 'msg': "Could not send message"}
    
    return JsonResponse(msg);
