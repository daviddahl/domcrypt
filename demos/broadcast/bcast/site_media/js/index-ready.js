var jsonMessages = [];
// need to populate this with sample messages once we have
//  a working message composer
var timelineData = [];
var followers = [];
var timelineIndex = {};

$(document).ready(function() {
  // check for DOMCrypt
  checkDOMCrypt();
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

  try {
    // need to check for credentials, decrypt them and configure the application
    var _credentials = localStorage.getItem("credentials");
    if (!_credentials) {
      alert("It looks like you do not have an account yet, redirecting momentarily...");
      document.location = "/bcast/create/account/";
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
      window.messageComposer = new MessageComposer(credentialsPlainObj, []);
    });
  }
  catch (ex) {
    console.log(ex);
    console.log(ex.stack);
  }
});
