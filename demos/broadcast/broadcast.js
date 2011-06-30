var jsonMessages = [];
// need to populate this with sample messages once we have
//  a working message composer
var timelineData = [];
var followers = [];
var messageComposer;
var timelineIndex = {};

$(document).ready(function() {
  // create message store
  var idx;
  for (idx in jsonMessages) {
    var message = JSON.parse(jsonMessages[idx]);
    timelineData.push(message);
  }
  // now we need to populate the messages div with messages
  for (idx in timelineData) {
    MessageDisplay(timelineData[idx]);
  }
  messageComposer = new MessageComposer("drzhivago", []);
});

function MessageDisplay(aMessageData)
{
  var tmpl = '<div class="msg" id="{id}">'
             + '<div class="msg-date">{date}</div>'
             + '<div class="msg-author">{author}</div>'
             + '<div class="msg-content">{cipherText}</div>'
             + '<button class="read-one" onclick="DisplayPlainText(this);">Read</button>'
             + '</div>';
  var node = $(tmpl.printf(aMessageData));
  $("#msg-input")[0].value = "";
  $("#messages").prepend(node);
  timelineIndex[aMessageData.id] = aMessageData;
}

function DisplayPlainText(aNode)
{
  console.log(aNode);
  var id = aNode.parentNode.getAttribute("id");
  console.log(id);
  new MessageReader(id);
}

function MessageComposer(aDisplayName, aFollowers)
{
  // normally in the MessageComposer, you would:
  // 1. encrypt text
  // 2. get a list of all followers' hashIds and pubKeys
  // 3. wrapKeys for all followers
  // 4. push the message bundle to the server
  // In this demo we will just add the message to the timeline of the current user
  this.author = aDisplayName;
  this.followers = aFollowers;
  var self = this;
  mozCipher.pk.getPublicKey(function (aPubKey){
    self.authorPubKey = aPubKey;
    // TODO: activate the send button
  });
}

MessageComposer.prototype = {
  author: null,
  authorPubKey: null,
  followers: [],

  bundle: function mc_bundle(aCipherMessage)
  {
    var self = this;
    return { followers: [{handle: self.author, pubKey: self.authorPubKey }], message: aCipherMessage };
  },

  encrypt: function mc_encrypt()
  {
    var self = this;
    mozCipher.sym.encrypt($("#msg-input")[0].value, function (aCipherMsg) {
      aCipherMsg.author = this.author;
      var bundle = self.bundle(aCipherMsg);
      // TODO: send the bundle to the server...
      var date = new Date();
      console.log(self.author);
      MessageDisplay({author: self.author,
                      id: date.getTime(),
                      date: date.toString(),
                      cipherText: aCipherMsg.cipherText,
                      wrappedKey: aCipherMsg.wrappedKey,
                      iv: aCipherMsg.iv,
                      pubKey: aCipherMsg.pubKey});
    });
  },

  send: function mc_send()
  {
    // TODO
  },

  validate: function mc_validate()
  {
    var txt = $("#msg-input")[0].value;
    if (txt.length > 0 && txt.length < 4096) {
      this.encrypt();
    }
    else {
      // XXX: notify user of error
    }
  }
};

function MessageReader(aMessageID)
{
  this.id = aMessageID;
  this.decrypt();
}

MessageReader.prototype = {
  decrypt: function mr_decrypt()
  {
    var self = this;
    var msg = timelineIndex[this.id];
    mozCipher.sym.decrypt(msg, function (plainText) {
      var id = "#" + self.id;
      console.log(id);
      $(id)[0].childNodes[2].innerHTML =
        '<pre>{plainText}</pre>'.printf({plainText: plainText});
    });
  }
};

String.prototype.printf = function (obj) {
  var useArguments = false;
  var _arguments = arguments;
  var i = -1;
  if (typeof _arguments[0] == "string") {
    useArguments = true;
  }
  if (obj instanceof Array || useArguments) {
    return this.replace(/\%s/g,
    function (a, b) {
      i++;
      if (useArguments) {
        if (typeof _arguments[i] == 'string') {
          return _arguments[i];
        }
        else {
          throw new Error("Arguments element is an invalid type");
        }
      }
      return obj[i];
    });
  }
  else {
    return this.replace(/{([^{}]*)}/g,
    function (a, b) {
      var r = obj[b];
      return typeof r === 'string' || typeof r === 'number' ? r : a;
    });
  }
};
