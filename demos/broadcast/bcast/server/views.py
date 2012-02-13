import hashlib
import sys, traceback
from pprint import pprint

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
from django.db import connection, transaction

from django.core.serializers import serialize
from django.db.models.query import QuerySet

from bcast.server.models import Account, TimelineMessage, Hierarchy
from bcast.server.jsonresponse import JSONResponse

class JsonResponse(HttpResponse):
    content = None

    def __init__(self, object):
        if isinstance(object, QuerySet):
            content = serialize('json', object)
        else:
            content = simplejson.dumps(object)
        self.content = simplejson.loads(content)
        super(JsonResponse, self).__init__(content, mimetype='application/json')

def auth(identifier, login_token):
    """
    make sure the user is authorized to connect
    """
    # check for user credentials in the Account model
    # if no cigar, redirect to an error page
    try:
        seed = "%s-%s" % (identifier, login_token,) 
        hashed = hashlib.sha256(seed).hexdigest()
        print hashed
        acct = Account.objects.get(identifier=identifier)
        seed = "%s-%s" % (acct.identifier, acct.login_token,) 
        authkey = hashlib.sha256(seed).hexdigest()
        print authkey
        return True
        if seed == authkey:
            return True
        else:
            return False
    except Exception, e:
        print e
        return False
    
def index(request):
    """
    an index page
    """
    return render_to_response("index.html", {}, context_instance=RequestContext(request))

def login(request):
    """
    a login page
    """
    return render_to_response("login.html", {}, context_instance=RequestContext(request))

def create_account(request):
    """
    Create account screen
    """
    return render_to_response("create_account.html", {}, context_instance=RequestContext(request))


def destroy_account(request):
    """
    Destroy account screen
    """
    return render_to_response("destroy_account.html", {})

def x_create_acct(request):
    """
    Try to tell the server to create an account
    """
    try:
        # TODO: regex check for name formatting - cannot deviate 
        # from base64urlencode

        # create login_token
        seed = request.POST["password"]
        login_token = hashlib.sha256(seed).hexdigest()

        acct = Account(display_name=request.GET["n"], 
                       login_token=login_token,
                       pub_key=request.POST["pub_key"])
        acct.save()
        return JsonResponse({"status": "success", 
                             "login_token": acct.login_token,
                             "identifier": acct.identifier})
    except Exception, e:
        print e
        return JsonResponse({"status": "failure", 
                             "msg": e})

def x_destroy_acct(request):
    """
    destroy an account
    """

def x_post_msg(request):
    """
    XHR method for posting updates
    """
    # validate user credentials
    if not auth(request.POST["a1"], request.POST["a2"]):
        return JsonResponse({"status": "failure", "msg": "NOT_AUTHORIZED"})
    # validate input
    # worry about this later:)
    try:
        # insert author's timeline message
        message_bundle = simplejson.loads(request.POST["bundle"])
        print "ORIG MSG BUNDLE"
        pprint(message_bundle)
        print message_bundle['identifier']
        author = Account.objects.get(identifier__exact=message_bundle['identifier'])
        pprint(author)
        timeline_msg = TimelineMessage(recipient=author,
                                       author=author,
                                       content=message_bundle['cipherMsg']['cipherText'],
                                       wrapped_key=message_bundle['cipherMsg']['wrappedKey'],
                                       iv=message_bundle['cipherMsg']['iv'])
        timeline_msg.save()
        print "timeline_msg saved..."
        # insert all follower's timeline messages parented by the author's message
        # pprint(message_bundle['messages'])
        # messages = message_bundle['messages']
        messages = simplejson.loads(request.POST["messages"]);
        pprint(messages)
        for msg in messages:
            pprint(msg)
            recipient = Account.objects.get(display_name__exact=msg['follower'])
            pprint(recipient)
            tmsg = TimelineMessage(recipient=recipient,
                                   author=author,
                                   content=msg['cipherText'],
                                   wrapped_key=msg['wrappedKey'],
                                   iv=msg['iv'],
                                   parent_message_id=timeline_msg.id)
            tmsg.save()
        # return the original parent message id, etc
        return JsonResponse({"status": "success", 
                             "msg":"MESSAGE_SENT", 
                             "msgId": timeline_msg.id}
                            )
    except Exception, e:
        print e
        return JsonResponse({"status": "failure", "msg": e});

def x_get_msgs(request):
    """
    get messages 
    """
    try:
        id = request.GET["a1"]
        token = request.GET["a2"]
        lastid = None
        if request.GET.has_key("lastid"):
            try:
                # lastid = int(request.GET["lastid"])
                lastid = None
            except Exception, e:
                lastid = None
        # TODO fix the auth function
        acct = Account.objects.get(identifier__exact=id, login_token__exact=token)
        pprint(acct)
        if lastid is None:
            msgs = TimelineMessage.objects.filter(recipient=acct)[:100]
        else:
            msgs = TimelineMessage.objects.filter(recipient=acct, id__gt=lastid)[:100]

        return JSONResponse({"status": "success", "msg": msgs})
    except Exception, e:
        print e
        return JsonResponse({"status": "failure", "msg": "SERVER_ERROR"})

def x_remove_msg(request):
    """
    Remove a message and it's child messages from the timeline
    """
    
def x_check_display_name(request):
    """
    check if a display name is available
    """
    try:
        acct = Account.objects.filter(display_name__exact=request.GET['n'])
        print acct.count()
        if acct.count() > 0:
            return JsonResponse({"status": "failure", "available": 0})
        else:
            return JsonResponse({"status": "success", "available": 1})
    except Exception, e:
        print e
        return JsonResponse({"status": "failure", "available": 0, "msg": "SEVER_ERROR"})

def x_search_accts(request):
    """
    search for friends
    """
    try:
        if request.GET["n"]:
            # TODO: better validation
            print request.GET["n"]
            accts = Account.objects.filter(display_name__icontains=request.GET["n"])
            if accts.count() > 0:
                _accts = []
                for acct in accts:
                    _accts.append({"id": acct.identifier, 
                                   "display_name": acct.display_name})
                pprint(_accts)
                return JsonResponse({"status": "success", "msg": _accts})
            else:
                return JsonResponse({"status": "failure", "msg": "NONE_FOUND"})
    except Exception, e:
        print e
        return JsonResponse({"status": "failure", "msg": "SERVER_ERROR"})

def x_follow(request):
    """
    send a follow request
    """
    try:
        # TODO: do not allow following yourself
        if request.GET["follower"] and request.GET["leader"]:
            print request.GET["follower"]
            print request.GET["leader"]
            # get both users
            follower = Account.objects.get(identifier=request.GET["follower"])
            leader = Account.objects.get(identifier=request.GET["leader"])
            print follower
            print leader
            f = Hierarchy.objects.filter(leader=leader, follower=follower);
            if f.count() == 1:
                return JsonResponse({"status": "failure", "msg": "FOLLOWING", "leader": leader.display_name});
            if follower == leader:
                return JsonResponse({"status": "failure", "msg": "CANNOT_FOLLOW_YOURSELF", "leader": leader.display_name});
            f = Hierarchy(leader=leader, follower=follower)
            f.save()
            return JsonResponse({"status": "success", "msg": "FOLLOW_COMPLETED"})
    except Exception, e:
        print e
        return JsonResponse({"status": "failure", "msg": "FOLLOW_FAILED"})
        

def x_get_following(request):
    """
    get the display_names of those you are following
    """
    try:
        if auth(request.GET["a1"], request.GET["a2"]):
            user = Account.objects.get(identifier=request.GET["a1"], login_token=request.GET["a2"])
            cursor = connection.cursor()
            # TODO: write a join here
            cursor.execute("SELECT follower_id, leader_id FROM server_hierarchy WHERE follower_id=%s", [user.id])
            following = cursor.fetchall()
            _following = []
            for f in following:
                a = Account.objects.get(id=f[1])
                _following.append({"handle": a.display_name, "pubKey": a.pub_key})
            return JsonResponse({"status": "success", "msg": "FOLLOWING", "following": _following})
        else:
            return JsonResponse({"status": "failure", "msg": "SERVER_ERROR", "following":[]})
    except Exception, e:
        print e
        return JsonResponse({"status": "failure", "msg": "SERVER_ERROR", "followers":[]})       
def x_get_followers(request):
    """
    get followers
    """
    try:
        if auth(request.GET["a1"], request.GET["a2"]):
            user = Account.objects.get(identifier=request.GET["a1"], login_token=request.GET["a2"])
            cursor = connection.cursor()
            
            cursor.execute("SELECT follower_id, leader_id FROM server_hierarchy WHERE leader_id=%s", [user.id])
            followers = cursor.fetchall()
            _followers = []
            for f in followers:
                a = Account.objects.get(id=f[0])
                _followers.append({"handle": a.display_name, "pubKey": a.pub_key})
            return JsonResponse({"status": "success", "msg": "FOLLOWERS", "followers": _followers})
        else:
            return JsonResponse({"status": "failure", "msg": "SERVER_ERROR", "followers":[]})
    except Exception, e:
        print e
        return JsonResponse({"status": "failure", "msg": "SERVER_ERROR", "followers":[]})

def x_block(request):
    """
    send a block request
    """

def x_approve_follow(request):
    """
    approve a follow request
    """

def x_fetch_console(request):
    """
    fetch console messages
    """

def x_login(request):
    """
    login to existing account
    """
    if request.GET.has_key("user") and request.POST.has_key("password"):
        try:
            seed = request.POST["password"]
            login_token = hashlib.sha256(seed).hexdigest()
            a = Account.objects.get(login_token=login_token, 
                                    display_name=request.GET["user"])
            return JsonResponse({"status": "success", 
                                 "login_token": a.login_token,
                                 "identifier": a.identifier,
                                 "display_name": a.display_name})
        except Exception, e:
            print e
            return JsonResponse({"status": "failure", "msg": "Server Error"})
    else:
        return JsonResponse({"status": "failure", "msg": "Server Error"})

    
