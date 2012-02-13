function CreateAccount()
{
  // validate input
  var name = $("#chosen-name")[0].value;
  console.log(name);
  if (!this.checkName(name)) {
    alert("Chosen name is formatted incorrectly. Letters, numbers, - and _ are allowed.");
  }
  else {
    this.checkNameAvailable(name);
  }
}

CreateAccount.prototype = {
  base64URLRegex: /^[-abcdefghijklmnopqrstuvwxyz0123456789_]{1}$/i,

  checkName: function CA_checkName(name) {
    for (var i = 0; i < name.length; i++) {
      console.log(name[i]);
      if (!(!!name && this.base64URLRegex.test(name[i]))) {
        return false;
      }
    }
    console.log("name is ok to check!");
    return true;
  },

  checkNameAvailable: function CA_checkNameAvailable(aName)
  {
    var self = this;
    var url = "/bcast/_xhr/check/display/name/?n=" + aName;
    var config = {
      url: url,
      data: null,
      success: function success(data)
      {
        if (data.available) {
          self.submitChosenName(aName);
        }
      },
      error: function error(jqXHR, testStatus, err)
      {
        // TODO: better error notification
        alert(err);
      },
      dataType: "json"
    };
    $.ajax(config);
  },

  submitChosenName: function CA_submitChosenName(aName)
  {
    var password = $("#user-password")[0].value;
    if (password.length < 6) {
      notify("error:", "server password must be 6 characters", true);
      return;
    }
    console.log("submitChosenName");
    var self = this;
    var url = "/bcast/_xhr/create/acct/?n=" + aName;
    var csrf_token = $('#csrf_token >div >input').attr("value");
    console.log(csrf_token);
    var config = {
      url: url,
      type: "POST",
      data: { pub_key: window._pubKey,
              password: password,
              csrfmiddlewaretoken: csrf_token},
      dataType: "json",
      success: function success(data)
      {
        if (data.status == "success") {
          $("#chosen-name")[0].value = "";
          // get the login token and identifier and save them to localstorage
          self.saveCredentials(data.login_token, data.identifier, aName);
        }
      }
    };
    $.ajax(config);
  },

  saveCredentials: function CA_saveCredentials(aLoginToken, aID, aName)
  {
    var credentials = {
      token: aLoginToken,
      ID: aID,
      displayName: aName
    };

    var _credentials = JSON.stringify(credentials);

    mozCipher.pk.encrypt(_credentials, window._pubKey, function(aCryptoMsg){
      var credentials = JSON.stringify(aCryptoMsg);
      localStorage.setItem("credentials", credentials);
      alert("account created. redirecting...");
      var t = Date.now();
      document.location = "/bcast/?t=" + t;
    });
  }
};
