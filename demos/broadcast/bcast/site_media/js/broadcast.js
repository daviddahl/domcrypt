var jsonMessages = [];
// need to populate this with sample messages once we have
//  a working message composer
var timelineData = [];
var followers = [];
var messageComposer;
var timelineIndex = {};

$(document).ready(function() {
  // key bindings
  $("#search").keydown(function (event){
    if (event.keyCode == '13') {
      var str = $("#search")[0].value;
      if (str) {
        new SearchAccounts(str);
      }
    }
  });

  // focus events
  $("#search").focus(function (){
    if (this.value == "find people...") {
      this.value = "";
    }
  });

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
  try {
    // need to check for credentials, decrypt them and configure the application
    var _credentials = localStorage.getItem("credentials");
    if (!_credentials) {
      return;
    }
    // if (!_credentials) {
    //   // display login page
    //   document.location = "/bcast/login/";
    //   return;
    // }
    var credentials = JSON.parse(_credentials);
    // decrypt credentials
    mozCipher.pk.decrypt(credentials, function (plaintext){
      var credentialsPlainObj = JSON.parse(plaintext);
      // TODO: need to get follower_ids from the server
      messageComposer = new MessageComposer(credentialsPlainObj, []);
    });
  }
  catch (ex) {
    console.log(ex);
    console.log(ex.stack);
  }
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

function MessageComposer(aCredentials, aFollowers)
{
  // normally in the MessageComposer, you would:
  // 1. encrypt text
  // 2. get a list of all followers' hashIds and pubKeys
  // 3. wrapKeys for all followers
  // 4. push the message bundle to the server
  // In this demo we will just add the message to the timeline of the current user
  this.author = aCredentials.displayName;
  this.token = aCredentials.token;
  this.ID = aCredentials.ID;
  $("#display-name")[0].innerText = this.author;
  this.followers = aFollowers;
  var self = this;
  mozCipher.pk.getPublicKey(function (aPubKey){
    self.authorPubKey = aPubKey;
    self.followers.push({handle: self.author, pubKey: self.authorPubKey });
  });
}

MessageComposer.prototype = {
  author: null,

  token: null,

  ID: null,

  authorPubKey: null,

  followers: [],

  bundle: function mc_bundle(aCipherMessage)
  {
    console.log("bundle--->");
    console.log(aCipherMessage.idx);
    var self = this;
    var idx;
    var messages = [];
    var bundle = { cipherMsg: aCipherMessage,
                   identifier: self.ID,
                   author: self.author,
                   authorPubKey: self.authorPubKey
                 };
    // TODO: add authentication token and password to the bundle
    var len = self.followers.length;

    // need to re-wrap the key for each follower


    for (idx in self.followers) {
      mozCipher.sym.wrapKey(aCipherMessage, self.followers[idx].pubKey,
                            function wrapCallback(aCipherObj) {
        console.log("idx: " + idx);
        console.log("cm.idx: " + aCipherMessage.idx);
        aCipherObj.follower = self.followers[idx];
        messages.push(aCipherObj);
        if (aCipherMessage.idx == (idx + 1)) {
          bundle.messages = messages;
          self.send(bundle);
        }
      });
    }
  },

  encrypt: function mc_encrypt()
  {
    var self = this;
    var followersLen = this.followers.length;
    console.log(followersLen);
    mozCipher.sym.encrypt($("#msg-input")[0].value, function (aCipherMsg) {
      aCipherMsg.author = this.author;
      // TODO: send the bundle to the server...
      var date = new Date();
      console.log(self.author);
      var message = {author: self.author,
                     id: date.getTime(),
                     date: date.toString(),
                     cipherText: aCipherMsg.cipherText,
                     wrappedKey: aCipherMsg.wrappedKey,
                     iv: aCipherMsg.iv,
                     pubKey: aCipherMsg.pubKey,
                     idx: followersLen};

      var bundle = self.bundle(message);

      MessageDisplay(message);
    });
  },

  send: function mc_send(bundle)
  {
    var self = this;
    console.log(bundle);
    console.log(self.ID);
    console.log(self.token);
    var bundleStr = JSON.stringify(bundle);
    // TODO: HTTP POST to server
    console.log("SEND--->");
    var url = "/bcast/_xhr/post/msg/";
    var csrf_token = $('#csrf_token >div >input').attr("value");
    var config = {
      data: {
        a1: self.ID,
        a2: self.token,
        bundle: bundleStr,
        csrfmiddlewaretoken: csrf_token
      },
      url: url,
      type: "POST",
      dataType: "json",
      success: function success(data)
      {
        if (data.msgId) {
          alert("success: message sent");
        }
        else {
          console.log(data.msg);
          // TODO: keep a cache of the bundled message or ajax config in case
          // of a problem for re-sending
          alert("whoops: message was not sent");
        }
      }
    };
    $.ajax(config);

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
      $(id)[0].childNodes[2].innerHTML =
        '<pre>{plainText}</pre>'.printf({plainText: plainText});
      // disable read button
      $(id + " > .read-one")[0].disabled = true;
    });
  }
};

// Account format and creation

function Account(aAccountData)
{
  if (!("display_name" in aAccountData)) {
    throw new Error("Display Name is required");
  }
  var url, bio = null;
  if (aAccountData.url) {
    url = aAccountData.url;
  }
  if (aAccountData.bio) {
    bio = aAccountData.bio;
  }
  this.accountData = {identifier: null,
                      login_token: null,
                      bio: bio,
                      url: url,
                      display_name: aAccountData.display_name,
                      pub_key: null
                     };
  this.configureAccount();
}

Account.prototype = {
  accountData: null,

  accountStatus: function a_accountStatus()
  {
    // check if this is a valid account and user can login
    // HTTP post the bcastAcct data that we have
    // the server will tell us if the account displayname is available
    // if it is we can create the account
  },

  configureAccount: function a_configureAccount()
  {
    var bcastAcct;
    var _bcast_acct = localStorage.getItem("BCAST_ACCT");
    if (_bcast_acct) {
      bcastAcct = JSON.parse(_bcast_acct);
      if (bcastAcct.login_token && bcastAcct.identifier) {
        // looks like this account is already ready to go
        console.log("Account is ready");
        return;
      }
      else if (bcastAcct.display_name) {
        // we need to see if the account can be created
        this.accountStatus(bcastAcct);
      }
    }
    var self = this;
    // TODO detect missing publickey, generate one
    mozCipher.pk.getPublicKey(function (aPubKey){
      self.accountData.pub_key = aPubKey;
      mozCipher.hash.SHA256(aPubKey, function (aHash){
        self.accountData.identifier = aHash;
        console.log("account configured");
      });
    });
  },

  createAccount: function a_createAccount()
  {

  },

  destroyAccount: function a_destroyAccount()
  {

  }
};

function SearchAccounts(aNameFragment)
{
  // search for display names to follow people
  var url = "/bcast/_xhr/search/accounts/?n=" + aNameFragment + "&rndm=" + Date.now();
  var config = {
    url: url,
    dataType: "json",
    success: function success(data)
    {
      var errTmpl = '<p class="search-error">{err}</p>';
      if (data.status == "success") {
        var tmpl = '<p class="search-result" id="{id}">'
                   + '<span>{display_name}</span> '
                   + '<a class="txt-btn" onclick="follow(this);">follow...</a> '
                   + '<a class="txt-btn" onclick="block(this);">*block*</a>'
                   + '</p>';
        $("#search-results").children().remove();
        // display the names found in the results div
        for (var i = 0; i < data.msg.length; i++) {
          $("#search-results").append($(tmpl.printf(data.msg[i])));
        }
      }
      else {
        $("#search-results").children().remove();
        $("#search-results").append($(errTmpl.printf({err: "Not found"})));
        $(".search-error").fadeOut(2000);
      }
    }
  };
  $.ajax(config);
}

function follow(aNode)
{
  // get the id via the node's parent.parent.id
  var id = aNode.parentNode.getAttribute("id");

  // xhr that request up to the server
  var url = "/bcast/_xhr/follow/?follow=" + id + "&followee=" + messageComposer.ID;
  var config = {
    url: url,
    dataType: "json",
    success: function success(data)
    {
      if (data.status == "success") {
        alert("success: follow request was sent");
        // TODO: add the user to a 'following' list
      }
      else {
        alert("server error: follow request failed");
      }
    }
  };
  $.ajax(config);
}

function block(aNode)
{

}

// Utilities
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
