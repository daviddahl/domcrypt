// MessageDrop script

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
  // add click event handler to open and decrypt the message in a floating layer
}

function displayMessages(aMessages)
{
  // each message looks like
  // { hash: hsjfdshjdhjshjdhjsd, content: {...}, dateTime: 123456789 }
  var len = aMessages.length;
  var parent = $("#inbox-messages");
  for (var i = 0; i < len; i++) {
    var dt = aMessages[i].dateTime;
    var content = aMessages[i].content;
    var hash = aMessages[i].hash;
    var node = '<div onClick="displayMessage(this);" id="' + dt + '">' + dt +
                 '<div class="msg-content">' + content + '</div>' +
               '</div>';
    var msg = $('<div id=""');
    parent.prepend();
  }
}

function displayMessage(aNode)
{
  // open an in-content dialog, show the contents of the message,
  // then show the decrypt button

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
    var pubKey = window.crypt.getAddressbook()[recipient];
    var hash = window.crypt.makeHash(pubKey);
    var url = "/send/";
    var csrf_token = $('#csrf_token >div >input').attr("value");
    $.post(url,
           {_hash: hash, message: message, csrfmiddlewaretoken: csrf_token},
           function(aData){
      if (aData.status == 'success') {
        alert("Message sent");
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
    console.log(plainText);
    var recipient = $("#recipient-picker")[0].value;
    console.log(recipient);
    var addressbookEntry = window.crypt.getAddressbook()[recipient];
    console.log(addressbookEntry.pubKey);
    var hash = window.crypt.makeHash(addressbookEntry.pubKey);
    console.log(hash);
    var message = window.crypt.encrypt(plainText, addressbookEntry.pubKey);
    console.log(message);
    var messageText = JSON.stringify(message);
    console.log(messageText);
    $("#write-message").fadeOut();
    $("#cipher-text").text(messageText).fadeIn();
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
  });

  $("#go-compose").click(function () {
    var t = Date.now();
    document.location = "/compose/?t=" + t;
  });

  $("#send").click(function () {
    deliver();
  });

  if (window.location.pathname == "/messages/") {
    // check the mesages again
    fetchMessages();
  }

  if (window.location.pathname == "/compose/") {
    // check the mesages again
    $("#select-contact").click(chooseRecipientUI);
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
