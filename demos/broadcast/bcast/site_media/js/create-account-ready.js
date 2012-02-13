$(document).ready(function() {
  if (localStorage.getItem("credentials")) {
    alert("You already have an account, multiple accounts are not supported yet;)");
    document.location = "/bcast/?t=" + Date.now();
    return;
  }
  mozCipher.pk.getPublicKey(function (aPubKey) {
    window._pubKey = aPubKey;
    $("#create-account-btn").click(function (){ new CreateAccount(); });
  });
});
