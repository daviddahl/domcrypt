# stolen from http://djangosnippets.org/snippets/2411/
# Author: guetux
from django.db.models import Model
from django.db.models.query import QuerySet
from django.http import HttpResponse
from django.utils.encoding import force_unicode
from django.utils.simplejson import dumps, JSONEncoder

def jsonify_model(model):
    model_dict = model.__dict__
    for key, value in model_dict.items():
        if key.startswith('_'):
            del model_dict[key]
        else:
            model_dict[key] = force_unicode(value)
    return model_dict

class API_JSONEncoder(JSONEncoder):
    def default(self, obj):
        if isinstance(obj, QuerySet):
            return [jsonify_model(o) for o in obj]
        if isinstance(obj, Model):
            return jsonify_model(obj)
        return JSONEncoder.default(self,obj)

class JSONResponse(HttpResponse):
    status_code = 200

    def __init__(self, data):
        json_response = dumps(data, ensure_ascii=False, indent=2, cls=API_JSONEncoder)
        HttpResponse.__init__(self, json_response, mimetype="text/javascript")
