import hashlib
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

from bcast.server.models import Account, TimelineMessage, Follower
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
        acct = Account(display_name=request.GET["n"], 
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
        
        # insert all follower's timeline messages parented by the author's message
        for msg in message_bundle['messages']:
            recipient = Account.objects.get(display_name__exact=msg['follower']['handle'])
            tmsg = TimelineMessage(recipient=recipient,
                                   author=author,
                                   content=msg['cipherText'],
                                   wrapped_key=msg['wrappedKey'],
                                   iv=msg['iv'],
                                   parent_message_id=timeline_msg.id)
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
        if request.GET.has_key("offset"):
            limit = ":20%s" % (request.GET["offset"])
        else:
            limit = ":20"
        # TODO fix the auth function
        acct = Account.objects.get(identifier__exact=id, login_token__exact=token)
        pprint(acct)
        msgs = TimelineMessage.objects.filter(recipient=acct)

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
        if request.GET["follow"] and request.GET["followee"]:
            # get both users
            follow = Account.objects.get(identifier=request.GET["follow"])
            followee = Account.objects.get(identifier=request.GET["followee"])
            f = Follower.objects.filter(followee=followee, followed=follow);
            if f.count() == 1:
                return JsonResponse({"status": "failure", "msg": "FOLLOWING", "followee": followee.display_name});
            if follow == followee:
                return JsonResponse({"status": "failure", "msg": "CANNOT_FOLLOW_YOURSELF", "followee": followee.display_name});
            f = Follower(followee=followee, followed=follow)
            f.save()
            return JsonResponse({"status": "success", "msg": "FOLLOW_COMPLETED"})
    except Exception, e:
        print e
        return JsonResponse({"status": "failure", "msg": "FOLLOW_FAILED"})
        

def x_get_following(request):
    """
    get following
    """
    try:
        if auth(request.GET["a1"], request.GET["a2"]):
            user = Account.objects.get(identifier=request.GET["a1"], login_token=request.GET["a2"])
            cursor = connection.cursor()
            
            cursor.execute("SELECT followee_id, followed_id FROM server_follower WHERE followee_id=%s", [user.id])
            following = cursor.fetchall()
            _following = []
            for f in following:
                a = Account.objects.get(id=f[1])
                _following.append(a.display_name)
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
            
            cursor.execute("SELECT followee_id, followed_id FROM server_follower WHERE followed_id=%s", [user.id])
            followers = cursor.fetchall()
            _followers = []
            for f in followers:
                a = Account.objects.get(id=f[1])
                _followers.append(a.display_name)
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
