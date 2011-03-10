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

from django.core.serializers import serialize
from django.db.models.query import QuerySet

from dcserver.msgdrp.models import Message, Addressbook, generate_service_key
from dcserver.settings import DEFAULT_DOMAIN

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
    # TODO require svc_key for all fecthing and sending
    # TODO add fetched=False to query
    try:
        if request.GET['h'] is None:
            raise Exception("No messages for %s" % request.GET['h'])
        messages = Message.objects.filter(_hash=request.GET['h'])
        _msgs = []
        for message in messages:
            _msgs.append({'id': message.id,
                          'from': message._from,
                          'hash': message._hash, 
                          'content': message.content, 
                          'dateTime': str(message.date_time)})
            message.fetched = True
            message.save()
            # TODO: delete fetched messages on cronjob
        msg = { 'status': 'success', 'msg': _msgs }
 
    except Exception, e:
        msg = {'status': 'failure', 'msg': e}

    return JsonResponse(msg);

def messages(request):
    """
    Read messages 
    """
    return render_to_response("messages.html", {}, context_instance=RequestContext(request))

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
            message = Message(_hash=request.POST['_hash'], content=request.POST['message'], _from=request.POST['_from'])
            message.save()
            msg = {'status': 'success', 'msg': "Message sent", "id": message.id }

    except Exception, e:
        print e
        msg = {'status': 'failure', 'msg': "Could not send message"}
    
    return JsonResponse(msg);

def begin_create_addressbook_entry(request):
    """
    display create addressbook entry page
    """
    return render_to_response("begin_create_addressbook_entry.html", {}, context_instance=RequestContext(request))

def created_addressbook_entry(request):
    """
    create new entry and show user what the addressbook entry pagel looks like
    """
    return render_to_response("show_new_entry.html", {}, context_instance=RequestContext(request))

def display_addressbook_entry(request, handle):
    """
    lookup entry based on handle, display entry page
    """
    try:
        msg = "Not Found"
        if len(handle) < 3:
            msg = "Please enter at least 3 characters of the handle you seek";
            entry = None
        else:
            entry = Addressbook.objects.filter(handle__contains=handle)
            if entry.count() > 1:
                msg = "addressbook entries were found"
                return render_to_response("entry_search_list.html", 
                                          {"entry": entry,
                                           "handle_lookup": handle,
                                           "msg": msg }, 
                                          context_instance=RequestContext(request))
            if entry.count() == 1:
                msg = entry[0].handle + " addressbook entry was found"
                return render_to_response("display_addressbook_entry.html", 
                                          {"entry": entry[0],
                                           "handle_lookup": handle,
                                           "msg": msg }, 
                                          context_instance=RequestContext(request))
    except Exception, e:
        print e
        entry = None
        msg = "Addressbook entry was not found"
    return render_to_response("entry_search_list.html", 
                              {"entry": entry,
                               "handle_lookup": handle,
                               "msg": msg }, 
                              context_instance=RequestContext(request))

def addressbook(request):
    """
    search the addressbook by handle
    """
    return render_to_response("addressbook.html", {}, context_instance=RequestContext(request))

def process_addressbook_creation(request):
    """
    Check for a handle that can be used 
    """
    try:
        if request.POST['pubKey'] and request.POST['handle'] and request.POST['hash']:
            # make service key
            svc_key = generate_service_key(request.POST['hash'])
            # we have the requisite data, let's store it
            entry = Addressbook.objects.create(handle=request.GET['handle'],
                                               _hash=request.POST['hash'],
                                               pub_key=request.POST['pubKey'],
                                               service_key=svc_key,
                                               domain=DEFAULT_DOMAIN)
            msg = "Addressbook entry was created";
            results = { 'serviceKey': entry.service_key,
                        'entryURL': "/addressbook/" + entry.handle + "/",
                        'msg': msg,
                        'status': 'success' }
        else:
            results = { 'status': 'failure', 
                        'msg': 'Error creating addressbook entry' }
            
    except Exception, e:
        print e
        msg = "Server Failure: Addressbook entry was not created"
        results = {'status': "failure", 'msg': msg + " " + e}

    return JsonResponse(results);
    
