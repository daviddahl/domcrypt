// MessageDrop script
var MessageData = {
  saveMessageBox: function MD_saveMessageBox(aName)
  {
    if (!localStorage.getItem(aName)) {
      throw new Error("localStorage: Cannot save to " + aName);
    }
    localStorage.setItem(aName, JSON.stringify(MessageData[aName]));
  },

  inBox: {},

  outBox: {}
};

function firstRun()
{
  // TODO: convert this app to a single page web app so all of this
  // data loading is kept to a minimum
  if (!localStorage.getItem("first-run")) {
    // create mailboxes
    var _date = Date.now();
    _date = parseInt(_date);
    localStorage.setItem("outBox", '{"index": []}');
    localStorage.setItem("inBox", '{"index": []}');
    localStorage.setItem("first-run", Date.now());
  }
  // load dbs
  MessageData.inBox = JSON.parse(localStorage.getItem("inBox"));
  MessageData.outBox = JSON.parse(localStorage.getItem("outBox"));
}

function fetchMessages()
{
  var url = "/fetch/?h=" + window.crypt.makeHash(window.crypt.getPubKey());
  // get all messages on server, store in localStorage, display list "inbox"
  $.get(url, function (aData){
    if (aData.status == 'success') {
      displayMessages(aData.msg);
    }
    else {
      alert(aData.msg);
    }
  });
}

function displayInBoxMessages()
{
  // TODO load messages from MessageData.inBox
}

function displayMessages(aMessages)
{
  // each message looks like
  // { hash: hsjfdshjdhjshjdhjsd, content: {...}, dateTime: 123456789 }
  // TODO: add TIME_ZONE to each message as it is composed
  var len = aMessages.length;
  var parent = $("#inbox-messages");
  for (var i = 0; i < len; i++) {
    // save incoming message to localStorage
    var id = aMessages[i].id;
    MessageData.inBox[id] = aMessages[i];
    var dt = aMessages[i].dateTime;
    var content = aMessages[i].content;
    var hash = aMessages[i].hash;
    var from = aMessages[i].from;
    var node = '<div class="msg-list-msg" id="' + id +
                 '"><button onClick="displayMessage(this, ' +
                   id + ');">Read</button><span class="msg-title"> From  ' + from +
                 " @" + dt +
                 '</span><a name="message-' + id  +  '"></a>' +
                 '<div class="msg-content">' + content + '</div>' +
                 '<pre class="plain-message" id="msg-plain-' + id + '"></pre>' +
               '</div>';
    parent.prepend(node);
  }
  $("#msg-count").text(aMessages.length);
  // TODO: localStorage is slow, maybe move this to indexedDB
  // save messages to localStorage
  // MessageData.saveMessageBox("inBox");
}

function displayMessage(aNode, aID)
{
  // show the contents of the message
  aNode.parentNode.scrollIntoView(true);
  var messageContent = aNode.parentNode.childNodes[3].textContent;
  console.log(messageContent);
  var messageObj = JSON.parse(messageContent);
  try {
    var message = window.crypt.promptDecrypt(messageObj);
    console.log(message);
    $("#msg-plain-" + aID)[0].innerHTML = message;
  }
  catch (ex) {
    alert(ex);
  }
}

function deliver()
{
  encryptMessage();
  send();
}

function send(aMsg)
{
  // post the message to the server, alert user of status
  if ($("#recipient-picker")[0].value && $("#cipher-text").text()) {
    var message = $("#cipher-text").text();
    var recipient = $("#recipient-picker")[0].value;
    var pubKey = window.crypt.getAddressbook()[recipient].pubKey;
    var hash = window.crypt.makeHash(pubKey);
    var url = "/send/";
    var csrf_token = $('#csrf_token >div >input').attr("value");
    // TODO: add server SVC_KEY to all post and get requests
    $.post(url,
           { _hash: hash,
             _from: localStorage.getItem("handle"),
             message: message,
             recipient: recipient,
             csrfmiddlewaretoken: csrf_token },
    function(aData){
      if (aData.status == 'success') {
        // save the message to localStorage:
        var outMsg = { to: recipient,
                       plain: $("#write-message")[0].value,
                       cipher: $("#cipher-text").text() };
        var _outMsg = JSON.stringify(outMsg);
        MessageData.outBox[aData.id] = _outMsg;
        MessageData.saveMessageBox("outBox");

        $("#results").children().remove();
        $("#results").append($('<h3>Message Sent. <a href="/compose/">Compose another message?</a></h3>'));
      }
      else {
        alert("Could not send message");
      }
    });
  }
}

function encryptMessage()
{
  if ($("#recipient-picker")[0].value && $("#write-message")[0].value) {
    var plainText = $("#write-message")[0].value;
    var recipient = $("#recipient-picker")[0].value;
    var addressbookEntry = window.crypt.getAddressbook()[recipient];
    var hash = window.crypt.makeHash(addressbookEntry.pubKey);
    var message = window.crypt.encrypt(plainText, addressbookEntry.pubKey);
    var messageText = JSON.stringify(message);
    $("#write-message").fadeOut("slow");
    $("#cipher-text").text(messageText).fadeIn("slow");
  }
  else {
    alert("You must select a recipient and enter a message");
  }
}

function chooseRecipientUI()
{
  // display UI to pick recipient from Addressbook
  // get addressbook entries:
  var entries = window.crypt.getAddressbook();
  var entriesArr = [];
  for (var prop in entries) {
    entriesArr.push(entries[prop]);
  }
  var picker = $('<select id="recipient-picker"></select>');
  for (var i = 0;  i < entriesArr.length; i++) {
    var opt = $('<option>' + "@" + entriesArr[i].domain + "/" +
                entriesArr[i].handle  + '</option>');
    picker.append(opt);
  }

  $("#place-picker").children().remove();
  $("#place-picker").append(picker);
}

function onLoad()
{
  // setup the app...
  $("#go-messages").click(function () {
    var t = Date.now();
    document.location = "/messages/?t=" + t;
    firstRun();
  });

  $("#go-home").click(function () {
    document.location = "/";
    firstRun();
  });

  $("#go-compose").click(function () {
    var t = Date.now();
    document.location = "/compose/?t=" + t;
    firstRun();
  });

  $("#send").click(function () {
    try {
      $("#send").attr("disabled", true);
      deliver();
    }
    catch (ex) {
      $("#send").attr("disabled", false);
    }
  });

  $("#go-addressbook").click(function () {
    document.location = "/addressbook/";
  });

  $("#go-addressbook-create").click(function () {
    document.location = "/create/addressbook/entry/";
  });

  if (window.location.pathname == "/messages/") {
    // check the mesages again
    fetchMessages();
  }

  if (window.location.pathname == "/compose/") {
    // check the mesages again
    $("#select-contact").click(chooseRecipientUI);
  }

  if (window.location.pathname == "/") {
    // check for DOMCrypt and check for addressbook
    var _crypt = false;
    var _pubKey = false;
    var _addressBook = false;
    var loadMessage = [];
    if (!window.crypt) {
      loadMessage.push($("<div class=\"setup-status\">You will need to install the <a href=\"http://mozilla.ddahl.com/domcrypt/extension/built/domcrypt.xpi\">DOMCrypt Extension</a> to use this site</div>"));
    }
    else {
      _crypt = true;
    }

    if (window.crypt) {
      if (window.crypt.getAddressbook() == {}) {
        loadMessage.push($("<div class=\"setup-status\">Your local addressbook is empty, you will need to <a href=\"/create/addressbook/entry/\">create an addressbook entry</a> to use this site</div>"));
      }
      else {
        _addressBook = true;
      }
    }

    if (window.crypt) {
      if (window.crypt.getPubKey()) {
        _pubKey = true;
      }
    }

    if (_pubKey && _crypt) {
      loadMessage.push($("<div class=\"setup-status\">Your browser is setup to use this site :)</div>"));
    }
    if (loadMessage.length) {
      for (var i = 0; i < loadMessage.length; i++) {
        $("#setup-status-messages").append(loadMessage[i]);
      }
    }
  }

  if (window.location.pathname == "/addressbook/") {
    // set the addressbook search button onclick
    $("#search-addressbook").click(function(){
      var handle = $("#enter-handle")[0].value;
      if (handle) {
        document.location = "/addressbook/" + handle + "/";
      }
      else {
        alert("Please enter a Handle");
      }
    });
  }

  if (window.location.pathname == "/create/addressbook/entry/") {
    $("#create-message-password").click(function (){
      // start generateKeyPair()
      window.crypt.generateKeyPair();
      window.setTimeout(function() {
        if (window.crypt.getPubKey()) {
          // we have a key, we can proceed
          alert("Your password was successfully created");
        }
        else {
          alert("There was an error creating your password");
        }
      }
      , 2000);
    });

    $("#create-addressbook-entry").click(function() {

      // TODO: validate handle against regex
      var handle = $("#handle")[0].value;
      if (!handle) {
        alert("Please enter a handle");
        return;
      }
      // check for a pubKey already created
      var pubKey = window.crypt.getPubKey();
      if (pubKey) {
        // gather bits for addressbook entry:
        var csrf_token = $('#csrf_token >div >input').attr("value");
        var addressbookInput = {
          pubKey: pubKey,
          handle: handle,
          hash: window.crypt.makeHash(pubKey),
          date: parseInt(Date.now()),
          csrfmiddlewaretoken: csrf_token
        };
        // XHR post this object
        var url = "/create/addressbook/entry/process/?handle=" + handle;
        $.post(url, addressbookInput, function(aData) {
          if (aData.status == "success") {
            // store Service Key in localStorage
            localStorage.setItem("SERVICE_KEY", aData.serviceKey);
            localStorage.setItem("ADDRESSBOOK_URL", aData.entryURL);
            localStorage.setItem("handle", handle);
            // show a confirmation that the addressbook entry was created
            $("#results").children().remove();
            $("#results").text(aData.msg);
            $("#addressbook-url").attr({href: aData.entryURL}).text(aData.entryURL);
            $("#handle")[0].value = "";
          }
          else {
            alert(aData.msg);
          }
        });
      }
      else {
        // need to create the pubKey
        alert("In order to use Messages, you will need to protect the messages you recieve with a passphrase.");
        window.crypt.generateKeyPair();
        $("#remind-repeat-click")[0].innerHTML = " &lt;- Password Saved, please click again to create your Addressbook Entry ";
      }
    });
  }
}

window.addEventListener("load", onLoad, false);

$.ajaxSetup({
  beforeSend: function(xhr, settings) {
    if (!(/^http:.*/.test(settings.url) || /^https:.*/.test(settings.url))) {
      // Only send the token to relative URLs i.e. locally.
      xhr.setRequestHeader("X-CSRFToken",
      $("#csrfmiddlewaretoken").val());
    }
  }
});
